import { destroySession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    // Obter token do cookie
    const token = getCookie(event, 'auth-token')

    if (token) {
      // Destruir sessão
      destroySession(token)
    }

    // Remover cookie
    setCookie(event, 'auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expira imediatamente
    })

    return {
      success: true,
      message: 'Logout realizado com sucesso'
    }

  } catch (error: any) {
    console.error('Logout error:', error)

    return {
      success: false,
      error: error.message || 'Erro ao fazer logout'
    }
  }
})