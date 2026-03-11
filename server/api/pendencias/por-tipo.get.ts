import { getSessionFromEvent } from '../../utils/session'
import { getPendenciasPorTipo } from '../../repositories/pendenciasRepository'

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  try {
    const data = await getPendenciasPorTipo()
    return { success: true, data }
  } catch (error: any) {
    console.error('[pendencias/por-tipo] Error:', error)
    return {
      success: false,
      error: error.message || 'Erro ao buscar pendências por tipo',
      data: []
    }
  }
})
