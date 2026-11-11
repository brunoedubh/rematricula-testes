/**
 * POST /api/e2e/cenarios  (aba "Não encontrados", PLANO.md 4)
 * Novo cenário no catálogo. Com `aPartirDe`, usa a gravação de um candidato
 * (gravacoes/candidatos/<cenario>--<aluno>.har) como gravação do cenário novo.
 *
 * Body: { id, titulo, perfil?, descricao?, esperado?: { rota?, textos?, botoes? },
 *         aPartirDe?: { cenario, codigoAluno, rota? } }
 */
import { z } from 'zod'
import { getSessionFromEvent } from '../../../utils/session'
import { CadastroError, criarCenario } from '../../../utils/e2e/cadastro'

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use letras minúsculas, números e hífen').max(60)

const esperadoSchema = z.object({
  rota: z.string().max(200).optional(),
  textos: z.array(z.string().max(200)).max(20).optional(),
  botoes: z.array(z.string().max(200)).max(20).optional()
})

const corpoSchema = z.object({
  id,
  titulo: z.string().trim().min(3).max(120),
  perfil: z.record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
  descricao: z.string().trim().max(300).optional(),
  esperado: esperadoSchema.optional(),
  aPartirDe: z.object({
    cenario: id,
    codigoAluno: z.coerce.number().int().positive(),
    rota: z.string().max(300).optional()
  }).optional()
})

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  const corpo = corpoSchema.safeParse(await readBody(event) ?? {})
  if (!corpo.success) {
    throw createError({ statusCode: 400, message: z.prettifyError(corpo.error) })
  }
  const { perfil, descricao, ...resto } = corpo.data
  // Sem perfil de colunas, a descrição vira o perfil (cenário manual).
  const perfilFinal = { ...(perfil ?? {}), ...(descricao ? { descricao } : {}) }

  try {
    const cenario = await criarCenario({ ...resto, perfil: perfilFinal }, session.email)
    return { success: true, cenario }
  } catch (e) {
    if (e instanceof CadastroError) throw createError({ statusCode: e.statusCode, message: e.message })
    throw e
  }
})
