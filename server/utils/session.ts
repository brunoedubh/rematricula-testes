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
    const config = useRuntimeConfig()
    const decoded = jwt.verify(token, config.sessionSecret) as any

    if (!decoded.sessionId) {
      return { user: null as any, isValid: false }
    }

    const sessionUser = sessionStore.get(decoded.sessionId)

    if (!sessionUser) {
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

// Limpar sessões expiradas a cada 30 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredSessions, 30 * 60 * 1000)
}