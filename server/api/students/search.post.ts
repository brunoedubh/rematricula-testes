import type { StudentSearchRequest, StudentSearchResponse, Aluno } from '../../../types'
import { getSessionFromEvent } from '../../utils/session'

export default defineEventHandler(async (event): Promise<StudentSearchResponse> => {
  try {
    // Verificar se o usuário está autenticado
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Não autenticado'
      })
    }

    const body = await readBody(event) as StudentSearchRequest
    const config = useRuntimeConfig()

    // Validação básica
    if (!body.searchTerm && !body.studentCode) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Termo de busca ou código do aluno são obrigatórios'
      })
    }

    // Determinar configurações do Databricks baseadas no ambiente
    const environment = body.environment || 'dev'
    const databricksConfig = getDatabricksConfig(environment, config)

    if (!databricksConfig) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Configuração do Databricks não encontrada'
      })
    }

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
      error: error.statusMessage || error.message || 'Erro interno do servidor',
      students: [],
      total: 0
    }
  }
})

function getDatabricksConfig(environment: string, config: any) {
  switch (environment.toLowerCase()) {
    case 'dev':
      return {
        workspace: config.databricksWorkspaceDev,
        clientId: config.databricksClientIdDev,
        clientSecret: config.databricksClientSecretDev
      }
    case 'prod':
      return {
        workspace: config.databricksWorkspaceProd,
        clientId: config.databricksClientIdProd,
        clientSecret: config.databricksClientSecretProd
      }
    default:
      return null
  }
}

async function searchStudentsInDatabricks(
  databricksConfig: any,
  searchParams: StudentSearchRequest,
  userEmail: string
): Promise<Aluno[]> {
  try {
    // Primeiro, obter um token de acesso
    const token = await getDatabricksToken(databricksConfig)
    if (!token) {
      throw new Error('Falha ao obter token do Databricks')
    }

    // Construir query SQL baseada nos parâmetros de busca
    const query = buildStudentSearchQuery(searchParams)

    // Executar query no Databricks SQL
    const response = await fetch(`${databricksConfig.workspace}/api/2.0/sql/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        statement: query,
        warehouse_id: databricksConfig.warehouseId,
        catalog: 'default',
        schema: 'students',
        parameters: buildQueryParameters(searchParams)
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Databricks query failed:', errorData)
      throw new Error('Falha na consulta ao Databricks')
    }

    const data = await response.json()

    // Aguardar conclusão da query se necessário
    if (data.state?.toLowerCase() === 'pending') {
      const finalResult = await waitForQueryCompletion(
        databricksConfig.workspace,
        token,
        data.statement_id
      )
      return parseStudentResults(finalResult)
    }

    return parseStudentResults(data)

  } catch (error) {
    console.error('Error searching students in Databricks:', error)
    return []
  }
}

async function getDatabricksToken(databricksConfig: any): Promise<string | null> {
  try {
    const response = await fetch(`${databricksConfig.workspace}/api/2.0/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${databricksConfig.clientId}:${databricksConfig.clientSecret}`).toString('base64')}`
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

    return null
  } catch (error) {
    console.error('Error getting Databricks token:', error)
    return null
  }
}

function buildStudentSearchQuery(searchParams: StudentSearchRequest): string {
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

function buildQueryParameters(searchParams: StudentSearchRequest): Record<string, any> {
  const params: Record<string, any> = {}

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

async function waitForQueryCompletion(
  workspace: string,
  token: string,
  statementId: string,
  maxWaitTime = 30000
): Promise<any> {
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

function parseStudentResults(data: any): Aluno[] {
  try {
    if (!data.result?.data_array) {
      return []
    }

    return data.result.data_array.map((row: any[]) => ({
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