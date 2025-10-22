import type { StudentSearchRequest, StudentSearchResponse } from '../../../types'
import { getSessionFromEvent } from '../../utils/session'
import { findStudents } from '../../repositories/databricksRepository'

/**
 * Endpoint para busca de alunos
 * Busca apenas dados do Databricks (data warehouse)
 * Status de bloqueio é buscado separadamente quando necessário
 */
export default defineEventHandler(async (event): Promise<StudentSearchResponse> => {
  try {
    // Verificar se o usuário está autenticado
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        message: 'Não autenticado'
      })
    }

    const body = await readBody(event) as StudentSearchRequest

    // Validação básica
    if (!body.searchTerm && !body.studentCode && !body.studentRA && !body.course && !body.marca && !body.persona && !body.categoriaGrade && !body.IND_CONTRATO_ASSINADO ) {
      throw createError({
        statusCode: 400,
        message: 'Termo de busca ou código do aluno são obrigatórios'
      })
    }

    // Buscar alunos no Databricks (apenas dados do data warehouse)
    const students = await findStudents(body, session.email)

    return {
      success: true,
      students: students,
      total: students.length,
      searchTerm: body.searchTerm,
      studentCode: body.studentCode
    }

  } catch (error: any) {
    console.error('Student search error:', error)

    return {
      success: false,
      error: error.message || 'Erro interno do servidor',
      students: [],
      total: 0
    }
  }
})
