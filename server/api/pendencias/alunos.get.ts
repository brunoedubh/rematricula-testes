import { getSessionFromEvent } from '../../utils/session'
import { getAlunosComPendencias } from '../../repositories/pendenciasRepository'

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  try {
    const data = await getAlunosComPendencias(200)
    return { success: true, data, total: data.length }
  } catch (error) {
    console.error('[pendencias/alunos] Error:', error)
    return {
      success: false,
      error: (error instanceof Error ? error.message : 'Erro ao buscar alunos com pendências'),
      data: [],
      total: 0
    }
  }
})
