/**
 * GET /api/e2e/cenarios
 * Catálogo de cenários do e2e, gravações/capturas de cada um e estado da esteira
 * (a tela consulta de novo enquanto a geração está em andamento).
 */
import type { FiltroCenarioE2e, RespostaCenariosE2e } from '../../../../types'
import { getSessionFromEvent } from '../../../utils/session'
import { condicoesDoCenario, lerCatalogo, lerDescartados, whereDoCenario } from '../../../utils/e2e/catalogo'
import { sqlCandidatosE2e } from '../../../utils/databricks'
import { arquivosDosCenarios } from '../../../utils/e2e/arquivos'
import { estadoEsteira } from '../../../utils/e2e/esteira'

export default defineEventHandler(async (event): Promise<RespostaCenariosE2e> => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  const catalogo = await lerCatalogo()
  const [arquivos, descartados] = await Promise.all([arquivosDosCenarios(catalogo.cenarios.map(c => c.id)), lerDescartados()])

  // O SQL que a esteira roda para cada cenário (mesmo montador): a tela mostra e deixa editar o perfil.
  const filtros: Record<string, FiltroCenarioE2e> = {}
  for (const c of catalogo.cenarios) {
    const manual = c.fonte === 'manual'
    try {
      const condicoes = condicoesDoCenario(c, (descartados[c.id] ?? []).map(d => d.codigoAluno))
      filtros[c.id] = { manual, where: whereDoCenario(c) || undefined, sql: condicoes.length ? sqlCandidatosE2e(condicoes, 5) : undefined }
    } catch (e) {
      filtros[c.id] = { manual, where: c.where, erro: e instanceof Error ? e.message : String(e) }
    }
  }
  return { cenarios: catalogo.cenarios, arquivos, esteira: estadoEsteira(), filtros, descartados }
})
