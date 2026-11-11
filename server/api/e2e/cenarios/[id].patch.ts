/**
 * PATCH /api/e2e/cenarios/:id
 * Ajusta título e `esperado` de um cenário. Com `confirmar: true`, um `a-confirmar`
 * passa a `gravado` (alguém conferiu a captura e preencheu a rota esperada, PLANO.md 3.3 passo 6).
 *
 * Body: { titulo?, esperado?: { rota?, textos?, botoes? }, confirmar? }
 */
import { z } from 'zod'
import { getSessionFromEvent } from '../../../utils/session'
import { CadastroError, alterarCenario } from '../../../utils/e2e/cadastro'

const corpoSchema = z.object({
  titulo: z.string().trim().min(3).max(120).optional(),
  esperado: z.object({
    rota: z.string().max(200).optional(),
    textos: z.array(z.string().max(200)).max(20).optional(),
    botoes: z.array(z.string().max(200)).max(20).optional()
  }).optional(),
  confirmar: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw createError({ statusCode: 400, message: 'Id inválido' })
  }
  const corpo = corpoSchema.safeParse(await readBody(event) ?? {})
  if (!corpo.success) {
    throw createError({ statusCode: 400, message: z.prettifyError(corpo.error) })
  }

  try {
    const cenario = await alterarCenario(id, corpo.data, session.email)
    return { success: true, cenario }
  } catch (e) {
    if (e instanceof CadastroError) throw createError({ statusCode: e.statusCode, message: e.message })
    throw e
  }
})
