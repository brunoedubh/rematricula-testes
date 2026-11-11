/**
 * POST /api/e2e/gravar  (② aluno informado por alguém do time, e2e/PLANO.md 4)
 * Roda a esteira para um aluno e devolve o resultado (gravado, a-confirmar, divergente…).
 *
 * Body: { id: string, codigoAluno: number, liberar?: boolean (padrão true), password?: string }
 */
import { z } from 'zod'
import { credenciaisDaSessao } from '../../utils/e2e/credenciais'
import { gravarAlunoInformado } from '../../utils/e2e/esteira'

const corpoSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  codigoAluno: z.coerce.number().int().positive(),
  liberar: z.boolean().default(true),
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
    const resultado = await gravarAlunoInformado(credenciais, corpo.data)
    return { success: true, resultado }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao gravar' }
  }
})
