/**
 * GET /api/e2e/execucoes/:id
 * Resultado de uma execução por cenário × dispositivo (e2e/resultados/<id>.json).
 */
import type { ExecucaoE2e } from '../../../../types'
import { getSessionFromEvent } from '../../../utils/session'
import { lerExecucao } from '../../../utils/e2e/execucao'

export default defineEventHandler(async (event): Promise<ExecucaoE2e> => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  const execucao = await lerExecucao(getRouterParam(event, 'id') ?? '')
  if (!execucao) {
    throw createError({ statusCode: 404, message: 'Execução não encontrada' })
  }
  return execucao
})
