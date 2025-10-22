import { getDb } from '../../utils/db_soft'

export default defineEventHandler(async () => {
  const db = getDb()
/*
  try {
    const result = await db.query(`
      SELECT *
      FROM escopo_regra reg
      LIMIT 2
    `)

    return {
      success: true,
      data: result.rows,
      count: result.rowCount
    }
  } catch (error) {
    console.error('Erro ao buscar dados do PostgreSQL:', error)
    throw createError({
      statusCode: 500,
      message: 'Erro ao conectar com o banco de dados PostgreSQL',
      data: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }*/
})