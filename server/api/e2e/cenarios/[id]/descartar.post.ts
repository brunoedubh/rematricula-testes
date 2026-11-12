/**
 * POST /api/e2e/cenarios/:id/descartar
 * Descarta um aluno do cenário (a captura mostra que ele não condiz): apaga a gravação dele e põe o código
 * na lista de descartados, que a esteira exclui do SQL. Com `restaurar: true`, só tira o código da lista.
 *
 * Body: { codigoAluno, motivo?, restaurar? }
 */
import { z } from 'zod'
import { getSessionFromEvent } from '../../../../utils/session'
import { CadastroError } from '../../../../utils/e2e/cadastro'
import { descartarAluno, restaurarDescartado } from '../../../../utils/e2e/descarte'

const corpoSchema = z.object({
  codigoAluno: z.coerce.number().int().positive(),
  motivo: z.string().trim().max(300).optional(),
  restaurar: z.boolean().optional()
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
    if (corpo.data.restaurar) {
      await restaurarDescartado(id, corpo.data.codigoAluno, session.email)
      return { success: true }
    }
    const r = await descartarAluno(id, corpo.data.codigoAluno, session.email, corpo.data.motivo || undefined)
    return { success: true, ...r }
  } catch (e) {
    if (e instanceof CadastroError) throw createError({ statusCode: e.statusCode, message: e.message })
    throw e
  }
})
