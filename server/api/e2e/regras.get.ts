/**
 * GET /api/e2e/regras
 * Regras de tela da rematrícula em ordem de prioridade (oráculo e2e/regras/regras.mjs), combinações de regras
 * (e2e/cenarios/combinacoes.json) e a última execução concluída, para a cobertura por regra (aba Regras).
 */
import type { RespostaRegrasE2e } from '../../../types'
import { getSessionFromEvent } from '../../utils/session'
import { lerCombinacoes, listarRegras } from '../../utils/e2e/regras'
import { existe } from '../../utils/e2e/arquivos'
import { lerExecucao, listarExecucoes } from '../../utils/e2e/execucao'

export default defineEventHandler(async (event): Promise<RespostaRegrasE2e> => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  const [regras, combinacoes, historico] = await Promise.all([listarRegras(), lerCombinacoes(), listarExecucoes()])
  const combinacoesExecutaveis: string[] = []
  for (const c of combinacoes) {
    if (await existe(`gravacoes/${c.base}.har`)) combinacoesExecutaveis.push(c.id)
  }
  const concluida = historico.find(e => e.situacao !== 'rodando')
  const ultimaExecucao = concluida ? (await lerExecucao(concluida.id)) ?? undefined : undefined

  return { regras, combinacoes, combinacoesExecutaveis, ultimaExecucao }
})
