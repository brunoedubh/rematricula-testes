import { getUserSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    // Obter token do cookie
    const token = getCookie(event, 'auth-token')

    if (!token) {
      throw createError({
        statusCode: 401,
        message: 'Token de autenticação não encontrado'
      })
    }

    // Verificar sessão
    const sessionData = getUserSession(token)

    if (!sessionData || !sessionData.isValid) {
      throw createError({
        statusCode: 401,
        message: 'Sessão inválida ou expirada'
      })
    }

    return {
      success: true,
      user: {
        email: sessionData.user.email,
        loggedIn: true,
        created_at: sessionData.user.created_at,
        expires_at: sessionData.user.expires_at
      }
    }

  } catch (error: any) {
    console.error('Auth check error:', error.message || error)

    throw createError({
      statusCode: 401,
      message: error.message || 'Não autenticado'
    })
  }
})