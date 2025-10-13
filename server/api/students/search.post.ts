import type { StudentSearchRequest, StudentSearchResponse } from '../../../types'
import { getSessionFromEvent } from '../../utils/session'
import { getDatabricksConfig, searchStudentsInDatabricks } from '../../utils/databricks'

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
    const config = useRuntimeConfig()

    // Validação básica
    if (!body.searchTerm && !body.studentCode && !body.studentRA && (!body.course && !body.marca)) {
      throw createError({
        statusCode: 400,
        message: 'Termo de busca ou código do aluno são obrigatórios'
      })
    }

    // Obter configuração do Databricks
    const databricksConfig = getDatabricksConfig(config)

    // Buscar alunos no Databricks
    const students = await searchStudentsInDatabricks(
      databricksConfig,
      body,
      session?.email || ''
    )

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
