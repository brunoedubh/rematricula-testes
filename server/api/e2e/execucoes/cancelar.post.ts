/**
 * POST /api/e2e/execucoes/cancelar
 * Encerra a execução em andamento (o resumo fica marcado como interrompido).
 */
import { getSessionFromEvent } from '../../../utils/session'
import { cancelarExecucao } from '../../../utils/e2e/execucao'

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  return { success: cancelarExecucao(session.email.split('@')[0] ?? session.email) }
})
