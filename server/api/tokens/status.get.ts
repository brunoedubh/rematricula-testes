/**
 * API para obter status dos tokens do usuário
 * GET /api/tokens/status
 *
 * Retorna informações sobre tokens em cache para cada ambiente
 */

import type { H3Event } from 'h3'
import { getSessionFromEvent } from '../../utils/session'
import { getTokensStatus } from '../../utils/token-cache'

interface TokenStatusResponse {
  success: boolean
  tokens?: {
    dev: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
    hml: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
    prod: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
  }
  error?: string
}

export default defineEventHandler(async (event: H3Event): Promise<TokenStatusResponse> => {
  try {
    // Verificar autenticação
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        message: 'Não autenticado'
      })
    }

    // Obter status dos tokens
    const tokensStatus = getTokensStatus(session.email)

    return {
      success: true,
      tokens: tokensStatus
    }

  } catch (error: any) {
    // Não logar erros de autenticação (401) - são esperados em rotas públicas
    if (error.statusCode !== 401) {
      console.error('Token status error:', error)
    }

    return {
      success: false,
      error: error.message || 'Erro ao obter status dos tokens'
    }
  }
})
