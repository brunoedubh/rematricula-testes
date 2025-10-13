import { destroySession, getSessionFromEvent } from '../../utils/session'
import { clearUserTokens } from '../../utils/token-cache'

export default defineEventHandler(async (event) => {
  try {
    // Obter sessão para limpar tokens do cache
    const session = await getSessionFromEvent(event)

    // Obter token do cookie
    const token = getCookie(event, 'auth-token')

    if (token) {
      // Destruir sessão
      destroySession(token)
    }

    // Limpar tokens do cache se houver sessão
    if (session) {
      clearUserTokens(session.email)
      console.log(`[LOGOUT] Tokens em cache limpos para ${session.email}`)
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