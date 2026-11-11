/**
 * POST /api/e2e/execucoes  (③ aba Execução, e2e/PLANO.md 5)
 * Roda a suíte em segundo plano (playwright test em e2e/). Não usa credencial: só as gravações.
 * O progresso sai em GET /api/e2e/execucoes/:id (o reporter atualiza o arquivo a cada teste).
 *
 * Body: { alvo: 'hml' | 'local' | 'dev', dispositivos: ('desktop' | 'mobile')[], cenarios?: string[] }
 */
import { z } from 'zod'
import { getSessionFromEvent } from '../../../utils/session'
import { DISPOSITIVOS_E2E, iniciarExecucao } from '../../../utils/e2e/execucao'

const corpoSchema = z.object({
  alvo: z.enum(['hml', 'local', 'dev']),
  dispositivos: z.array(z.enum(DISPOSITIVOS_E2E)).min(1),
  cenarios: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(200).optional()
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

  try {
    const id = await iniciarExecucao({
      ...corpo.data,
      dispositivos: [...new Set(corpo.data.dispositivos)],
      iniciadoPor: session.email.split('@')[0] ?? session.email
    })
    setResponseStatus(event, 202)
    return { success: true, id }
  } catch (e) {
    throw createError({ statusCode: 409, message: e instanceof Error ? e.message : 'Não foi possível iniciar a execução' })
  }
})
