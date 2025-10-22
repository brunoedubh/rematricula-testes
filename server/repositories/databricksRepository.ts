import type { StudentSearchRequest, Aluno, DatabricksConfig } from '../../types'
import { getDatabricksConfig, searchStudentsInDatabricks } from '../utils/databricks'

/**
 * Repository para operações com Databricks
 * Responsável apenas por buscar dados do data warehouse
 */

/**
 * Busca alunos no Databricks
 */
export async function findStudents(
  searchParams: StudentSearchRequest,
  userEmail: string
): Promise<Aluno[]> {
  const config = useRuntimeConfig()
  const databricksConfig = getDatabricksConfig(config)

  return await searchStudentsInDatabricks(
    databricksConfig,
    searchParams,
    userEmail
  )
}

/**
 * Busca um aluno específico por código
 */
export async function findStudentByCode(
  studentCode: string,
  userEmail: string
): Promise<Aluno | null> {
  const students = await findStudents({ studentCode }, userEmail)
  return students.length > 0 ? students[0] : null
}
