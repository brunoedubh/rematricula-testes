import { getSessionFromEvent } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const db = getDb()
  
  try {
    const result = await db.query('SELECT * FROM escopo_regra ORDER BY id DESC')
    
    return {
      success: true,
      data: result.rows
    }
  } catch (error) {
    console.error('Erro ao buscar produtos:', error)
    throw createError({
      statusCode: 500,
      message: 'Erro ao buscar produtos'
    })
  }
})