/**
 * GET /api/e2e/execucoes  (③ aba Execução, e2e/PLANO.md 5)
 * Alvos disponíveis, estado da execução em andamento e histórico (e2e/resultados/*.json).
 */
import type { RespostaExecucoesE2e } from '../../../../types'
import { getSessionFromEvent } from '../../../utils/session'
import { alvosE2e, DISPOSITIVOS_E2E, estadoExecucao, listarExecucoes } from '../../../utils/e2e/execucao'

export default defineEventHandler(async (event): Promise<RespostaExecucoesE2e> => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  return {
    alvos: alvosE2e(),
    dispositivos: [...DISPOSITIVOS_E2E],
    estado: estadoExecucao(),
    execucoes: await listarExecucoes()
  }
})
