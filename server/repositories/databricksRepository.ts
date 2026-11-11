import type { StudentSearchRequest, Aluno } from '../../types'
import { getDatabricksConfig, searchStudentsInDatabricks, searchCandidatesInDatabricks, type CandidatoE2e } from '../utils/databricks'

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
  return students[0] ?? null
}

/**
 * Candidatos da esteira do e2e para um perfil (condições já validadas)
 */
export async function findE2eCandidates(
  conditions: string[],
  limite = 5
): Promise<{ candidatos: CandidatoE2e[], total: number }> {
  const config = useRuntimeConfig()
  return await searchCandidatesInDatabricks(getDatabricksConfig(config), conditions, limite)
}
