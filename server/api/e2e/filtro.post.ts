/**
 * POST /api/e2e/filtro
 * Prévia do SQL de um WHERE (o mesmo montador da esteira) e, com `contar: true`, quantos alunos da view
 * satisfazem o filtro + uma amostra de códigos. Só leitura no Databricks; nada é gravado.
 *
 * Body: { where, id?, periodo?, contar? }   id: inclui os descartados daquele cenário (NOT IN)
 */
import { z } from 'zod'
import type { PreviaFiltroE2e } from '../../../types'
import { getSessionFromEvent } from '../../utils/session'
import { sqlCandidatosE2e } from '../../utils/databricks'
import { findE2eCandidates } from '../../repositories/databricksRepository'
import { condicoesDoCenario, lerDescartados } from '../../utils/e2e/catalogo'
import { WhereInvalidoError } from '../../utils/e2e/where'

const corpoSchema = z.object({
  where: z.string().max(2000),
  id: z.string().regex(/^[a-z0-9-]+$/).optional(),
  periodo: z.number().int().positive().optional(),
  contar: z.boolean().optional()
})

export default defineEventHandler(async (event): Promise<PreviaFiltroE2e> => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  const corpo = corpoSchema.safeParse(await readBody(event) ?? {})
  if (!corpo.success) {
    throw createError({ statusCode: 400, message: z.prettifyError(corpo.error) })
  }
  const { where, id, periodo, contar } = corpo.data
  const fonte = 'databricks' as const

  let condicoes: string[]
  try {
    const descartados = id ? (await lerDescartados())[id]?.map(d => d.codigoAluno) : undefined
    condicoes = condicoesDoCenario({ perfil: {}, where }, descartados, periodo)
  } catch (e) {
    if (e instanceof WhereInvalidoError) return { fonte, erro: e.message }
    throw e
  }
  const previa: PreviaFiltroE2e = { fonte, sql: sqlCandidatosE2e(condicoes, 5) }
  if (!contar) return previa

  try {
    const { candidatos, total } = await findE2eCandidates(condicoes, 10)
    console.log(`[AUDIT] ${session.email} (e2e) contou o filtro${id ? ` do cenário ${id}` : ''}: ${total} aluno(s)`)
    return { ...previa, total, amostra: candidatos.map(c => c.COD_ALUNO) }
  } catch (e) {
    return { ...previa, erro: `Databricks: ${e instanceof Error ? e.message : String(e)}` }
  }
})
