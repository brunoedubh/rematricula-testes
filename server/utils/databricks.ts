import type { DatabricksConfig, StudentSearchRequest, Aluno } from '../../types'

/**
 * Cliente para integra��o com Databricks SQL
 * Centraliza toda a l�gica de comunica��o com o Databricks
 */

/**
 * Obt�m um token de acesso do Databricks
 */
export async function getDatabricksToken(config: DatabricksConfig): Promise<string | null> {
  try {
    const response = await fetch(`${config.workspace}/api/2.0/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
      },
      body: JSON.stringify({
        lifetime_seconds: 3600,
        comment: 'Token para busca de alunos'
      })
    })

    if (response.ok) {
      const data = await response.json()
      return data.token_value
    }

    const errorData = await response.json()
    console.error('Databricks token creation failed:', errorData)
    return null
  } catch (error) {
    console.error('Error getting Databricks token:', error)
    return null
  }
}

/**
 * Constr�i a query SQL para busca de alunos
 */
export function buildStudentSearchQuery(searchParams: StudentSearchRequest): string {
  let query = `
    SELECT
      codigo_aluno,
      nome_completo,
      email,
      cpf,
      status_matricula,
      curso,
      periodo_atual,
      data_matricula,
      data_nascimento,
      telefone,
      endereco
    FROM students.alunos
    WHERE 1=1
  `

  if (searchParams.studentCode) {
    query += ` AND codigo_aluno = :studentCode`
  }

  if (searchParams.searchTerm) {
    query += ` AND (
      LOWER(nome_completo) LIKE LOWER(:searchTerm) OR
      LOWER(email) LIKE LOWER(:searchTerm) OR
      cpf = :exactTerm
    )`
  }

  if (searchParams.course) {
    query += ` AND LOWER(curso) LIKE LOWER(:course)`
  }

  if (searchParams.status) {
    query += ` AND status_matricula = :status`
  }

  query += ` ORDER BY nome_completo ASC LIMIT 50`

  return query
}

/**
 * Constr�i os par�metros para a query SQL
 */
export function buildQueryParameters(searchParams: StudentSearchRequest): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  if (searchParams.studentCode) {
    params.studentCode = searchParams.studentCode
  }

  if (searchParams.searchTerm) {
    params.searchTerm = `%${searchParams.searchTerm}%`
    params.exactTerm = searchParams.searchTerm
  }

  if (searchParams.course) {
    params.course = `%${searchParams.course}%`
  }

  if (searchParams.status) {
    params.status = searchParams.status
  }

  return params
}

/**
 * Aguarda a conclus�o de uma query no Databricks
 */
export async function waitForQueryCompletion(
  workspace: string,
  token: string,
  statementId: string,
  maxWaitTime = 30000
): Promise<Record<string, unknown>> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`${workspace}/api/2.0/sql/statements/${statementId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()

      if (data.state?.toLowerCase() === 'succeeded') {
        return data
      }

      if (data.state?.toLowerCase() === 'failed') {
        throw new Error('Query failed in Databricks')
      }
    }

    // Aguardar 1 segundo antes de tentar novamente
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Query timeout')
}

/**
 * Faz o parse dos resultados da query do Databricks para objetos Aluno
 */
export function parseStudentResults(data: Record<string, unknown>): Aluno[] {
  try {
    if (!data.result?.data_array) {
      return []
    }

    return data.result.data_array.map((row: unknown[]) => ({
      codigo_aluno: row[0],
      nome_completo: row[1],
      email: row[2],
      cpf: row[3],
      status_matricula: row[4],
      curso: row[5],
      periodo_atual: row[6],
      data_matricula: row[7],
      data_nascimento: row[8],
      telefone: row[9],
      endereco: row[10]
    }))
  } catch (error) {
    console.error('Error parsing student results:', error)
    return []
  }
}

/**
 * Executa uma query SQL no Databricks e retorna os resultados
 */
export async function executeQuery(
  config: DatabricksConfig,
  token: string,
  query: string,
  parameters?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${config.workspace}/api/2.0/sql/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        statement: query,
        warehouse_id: config.warehouseId,
        catalog: 'default',
        schema: 'students',
        parameters: parameters || {}
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Databricks query failed:', errorData)
      throw new Error('Falha na consulta ao Databricks')
    }

    const data = await response.json()

    // Aguardar conclus�o da query se necess�rio
    if (data.state?.toLowerCase() === 'pending' || data.state?.toLowerCase() === 'running') {
      return await waitForQueryCompletion(
        config.workspace,
        token,
        data.statement_id
      )
    }

    return data
  } catch (error) {
    console.error('Error executing Databricks query:', error)
    throw error
  }
}

/**
 * Busca alunos no Databricks baseado nos par�metros de busca
 * Fun��o principal que orquestra todo o processo
 */
export async function searchStudentsInDatabricks(
  config: DatabricksConfig,
  searchParams: StudentSearchRequest,
  userEmail: string
): Promise<Aluno[]> {
  try {
    // 1. Obter token de acesso
    const token = await getDatabricksToken(config)
    if (!token) {
      throw new Error('Falha ao obter token do Databricks')
    }

    // 2. Construir query e par�metros
    const query = buildStudentSearchQuery(searchParams)
    const parameters = buildQueryParameters(searchParams)

    // 3. Executar query
    const data = await executeQuery(config, token, query, parameters)

    // 4. Fazer parse dos resultados
    const students = parseStudentResults(data)

    // 5. Log de auditoria
    console.log(`[AUDIT] ${userEmail} buscou alunos - ${students.length} resultados`)

    return students
  } catch (error) {
    console.error('Error searching students in Databricks:', error)
    throw error
  }
}

/**
 * Obt�m a configura��o do Databricks baseada no ambiente
 */
export function getDatabricksConfig(environment: string, config: any): DatabricksConfig | null {
  switch (environment.toLowerCase()) {
    case 'dev':
    case 'hml':
      return {
        workspace: config.databricksWorkspaceDev,
        clientId: config.databricksClientIdDev,
        clientSecret: config.databricksClientSecretDev,
        warehouseId: config.databricksWarehouseIdDev
      }
    case 'prod':
      return {
        workspace: config.databricksWorkspaceProd,
        clientId: config.databricksClientIdProd,
        clientSecret: config.databricksClientSecretProd,
        warehouseId: config.databricksWarehouseIdProd
      }
    default:
      return null
  }
}
