/**
 * GET /api/e2e/cenarios
 * Catálogo de cenários do e2e, gravações/capturas de cada um e estado da esteira
 * (a tela consulta de novo enquanto a geração está em andamento).
 */
import type { RespostaCenariosE2e } from '../../../../types'
import { getSessionFromEvent } from '../../../utils/session'
import { lerCatalogo } from '../../../utils/e2e/catalogo'
import { arquivosDosCenarios } from '../../../utils/e2e/arquivos'
import { estadoEsteira } from '../../../utils/e2e/esteira'

export default defineEventHandler(async (event): Promise<RespostaCenariosE2e> => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  const catalogo = await lerCatalogo()
  const arquivos = await arquivosDosCenarios(catalogo.cenarios.map(c => c.id))
  return { cenarios: catalogo.cenarios, arquivos, esteira: estadoEsteira() }
})
