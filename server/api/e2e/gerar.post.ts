/**
 * POST /api/e2e/gerar  (① geração automática, e2e/PLANO.md 3)
 * Inicia a esteira em segundo plano para os cenários pendentes (ou os ids informados).
 * O progresso sai em GET /api/e2e/cenarios → esteira.
 *
 * Body: { ids?: string[], periodo?: number, candidatos?: number, password?: string }
 */
import { z } from 'zod'
import { credenciaisDaSessao } from '../../utils/e2e/credenciais'
import { iniciarGeracao } from '../../utils/e2e/esteira'

const corpoSchema = z.object({
  ids: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50).optional(),
  periodo: z.number().int().positive().optional(),
  candidatos: z.number().int().min(1).max(10).optional(),
  password: z.string().min(1).optional()
})

export default defineEventHandler(async (event) => {
  const corpo = corpoSchema.safeParse(await readBody(event) ?? {})
  if (!corpo.success) {
    throw createError({ statusCode: 400, message: z.prettifyError(corpo.error) })
  }

  const credenciais = await credenciaisDaSessao(event, corpo.data.password)
  if (!credenciais) {
    return { success: false, requiresPassword: true, error: 'Senha é necessária. Por favor, informe sua senha.' }
  }

  try {
    await iniciarGeracao(credenciais, corpo.data)
    setResponseStatus(event, 202)
    return { success: true }
  } catch (e) {
    throw createError({ statusCode: 409, message: e instanceof Error ? e.message : 'Não foi possível iniciar a geração' })
  }
})
