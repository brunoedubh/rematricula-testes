import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import type { SessionUser, SessionData } from '../../types'
import { decrypt } from '../utils/encryption'

const sessionStore = new Map<string, SessionUser>()

export function createSession(user: SessionUser): string {
  const config = useRuntimeConfig()

  const sessionId = generateSessionId()
  const expiresAt = Date.now() + parseInt(config.sessionDuration)

  const sessionUser: SessionUser = {
    ...user,
    expires_at: expiresAt
  }

  sessionStore.set(sessionId, sessionUser)

  // Criar JWT token
  const token = jwt.sign(
    { sessionId, email: user.email },
    config.sessionSecret,
    { expiresIn: '8h' }
  )

  return token
}

export function getUserSession(token: string): SessionData | null {
  try {
    // Limpar sessões expiradas de forma lazy
    cleanupIfNeeded()

    const config = useRuntimeConfig()
    const decoded = jwt.verify(token, config.sessionSecret) as any

    if (!decoded.sessionId) {
      return { user: null as any, isValid: false }
    }

    const sessionUser = sessionStore.get(decoded.sessionId)

    // Se a sessão não existe no store mas o JWT é válido,
    // recriar a sessão a partir do JWT (útil em dev com hot reload)
    if (!sessionUser) {
      // Verificar se o JWT ainda é válido
      if (decoded.exp && decoded.exp * 1000 > Date.now()) {
        // Recriar sessão a partir do JWT
        const reconstructedUser: SessionUser = {
          email: decoded.email,
          created_at: decoded.iat * 1000,
          expires_at: decoded.exp * 1000,
          encrypted_password: '' // Não podemos recuperar a senha, mas JWT é válido
        }

        // Adicionar de volta ao store
        sessionStore.set(decoded.sessionId, reconstructedUser)

        return {
          user: reconstructedUser,
          isValid: true
        }
      }

      return { user: null as any, isValid: false }
    }

    // Verificar se a sessão expirou
    if (Date.now() > sessionUser.expires_at) {
      sessionStore.delete(decoded.sessionId)
      return { user: null as any, isValid: false }
    }

    return {
      user: sessionUser,
      isValid: true
    }
  } catch (error) {
    return { user: null as any, isValid: false }
  }
}

export function destroySession(token: string): void {
  try {
    const config = useRuntimeConfig()
    const decoded = jwt.verify(token, config.sessionSecret) as any

    if (decoded.sessionId) {
      sessionStore.delete(decoded.sessionId)
    }
  } catch (error) {
    // Token inválido, não precisa fazer nada
  }
}

export function clearExpiredSessions(): void {
  const now = Date.now()

  for (const [sessionId, user] of sessionStore.entries()) {
    if (now > user.expires_at) {
      sessionStore.delete(sessionId)
    }
  }
}

export function getUserCredentials(sessionUser: SessionUser): { email: string, password: string } {
  const config = useRuntimeConfig()

  try {
    const decryptedPassword = decrypt(sessionUser.encrypted_password, config.encryptionKey)

    return {
      email: sessionUser.email,
      password: decryptedPassword
    }
  } catch (error) {
    throw new Error('Failed to decrypt user credentials')
  }
}

export async function getSessionFromEvent(event: any): Promise<SessionUser | null> {
  try {
    const token = getCookie(event, 'auth-token')
    if (!token) {
      return null
    }

    const sessionData = getUserSession(token)
    if (!sessionData || !sessionData.isValid || !sessionData.user) {
      return null
    }

    return sessionData.user
  } catch (error) {
    return null
  }
}

function generateSessionId(): string {
  return crypto.randomUUID()
}

// Última vez que as sessões foram limpas
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 30 * 60 * 1000 // 30 minutos

// Limpar sessões expiradas de forma lazy (quando necessário)
// Isso evita usar setInterval no servidor
function cleanupIfNeeded() {
  const now = Date.now()
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    clearExpiredSessions()
    lastCleanup = now
  }
}