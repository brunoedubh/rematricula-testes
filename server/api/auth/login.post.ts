import type { LoginRequest, LoginResponse, SessionUser } from '../../../types'
import { encrypt } from '../../utils/encryption'
import { createSession } from '../../utils/session'
import { generateTokensForEnvironments } from '../../utils/azure-token'

export default defineEventHandler(async (event): Promise<LoginResponse> => {
  try {
    const body = await readBody(event) as LoginRequest
    const config = useRuntimeConfig()

    // Validação básica
    if (!body.email || !body.password) {
      throw createError({
        statusCode: 400,
        message: 'Email e senha são obrigatórios'
      })
    }

    // Tentar validar credenciais com Azure AD
    const isValidCredentials = await validateAzureCredentials(body.email, body.password)

    if (!isValidCredentials) {
      throw createError({
        statusCode: 401,
        message: 'Credenciais inválidas'
      })
    }

    // Criptografar senha para armazenamento na sessão
    const encryptedPassword = encrypt(body.password, config.encryptionKey)

    // Criar dados da sessão
    const sessionUser: SessionUser = {
      email: body.email,
      encrypted_password: encryptedPassword,
      created_at: Date.now(),
      expires_at: Date.now() + parseInt(config.sessionDuration)
    }

    // Criar sessão e obter token
    const token = createSession(sessionUser)

    // Configurar cookie httpOnly
    setCookie(event, 'auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: parseInt(config.sessionDuration) / 1000 // Convert to seconds
    })

    // Gerar tokens para dev e hml de forma assíncrona (não bloqueia o login)
    // Produção NÃO é gerada no login, apenas quando solicitado com senha
    console.log(`[LOGIN] Iniciando geração assíncrona de tokens para ${body.email}`)
    generateTokensForEnvironments(body.email, body.password, ['dev', 'hml'])

    return {
      success: true,
      user: {
        email: body.email
      }
    }

  } catch (error: any) {
    console.error('Login error:', error)

    return {
      success: false,
      error: error.message || 'Erro interno do servidor'
    }
  }
})

async function validateAzureCredentials(email: string, password: string): Promise<boolean> {
  try {
    const config = useRuntimeConfig()

    // Determinar qual client ID usar baseado no email ou ambiente
    // Por enquanto, vamos usar DEV para todos os logins de validação
    const clientId = config.azureClientIdDev
    const scope = config.azureScopeDev

    if (!clientId || !scope) {
      console.error('Azure AD configuration missing')
      return false
    }

    // Fazer requisição ROPC para validar credenciais
    const response = await fetch('https://login.microsoftonline.com/organizations/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: email + '@homolog.animaeducacao.com.br', // Ajuste conforme necessário
        password: password,
        client_id: clientId,
        scope: scope
      })
    })

    if (response.ok) {
      const data = await response.json()
      // Se conseguimos obter um token, as credenciais são válidas
      return !!data.access_token
    }

    const errorData = await response.json()
    console.error('Azure AD validation failed:', errorData)
    return false

  } catch (error) {
    console.error('Error validating Azure credentials:', error)
    return false
  }
}