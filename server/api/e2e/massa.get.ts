/**
 * GET /api/e2e/massa
 * Massa de teste: código do aluno aprovado e dos candidatos de cada cenário, com o resumo do aluno no HML
 * (período, curso, persona, soft launch). Só dados acadêmicos; nome, CPF e contato não saem do HAR.
 */
import type { RespostaMassaE2e } from '../../../types'
import { getSessionFromEvent } from '../../utils/session'
import { montarMassa } from '../../utils/e2e/massa'

export default defineEventHandler(async (event): Promise<RespostaMassaE2e> => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  return montarMassa()
})
