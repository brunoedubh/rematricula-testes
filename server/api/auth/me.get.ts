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

    if (!sessionData || !sessionData.isValid || !sessionData.user) {
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

  } catch (error) {
    const err = error as { statusCode?: number; message?: string }
    // Não logar erros de autenticação esperados (token não encontrado)
    // Apenas logar erros inesperados
    if (err.statusCode !== 401 && err.message !== 'Token de autenticação não encontrado') {
      console.error('Auth check error:', err.message || error)
    }

    throw createError({
      statusCode: 401,
      message: err.message || 'Não autenticado'
    })
  }
})