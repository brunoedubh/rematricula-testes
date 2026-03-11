import { getSessionFromEvent } from '../../utils/session'
import { getResumoPendencias } from '../../repositories/pendenciasRepository'

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  try {
    const data = await getResumoPendencias()
    return { success: true, data }
  } catch (error: any) {
    console.error('[pendencias/resumo] Error:', error)
    return {
      success: false,
      error: error.message || 'Erro ao buscar resumo de pendências',
      data: { total_aptos: 0, total_com_pendencias: 0, total_pendencias_ativas: 0, percentual_pendentes: 0 }
    }
  }
})
