import type { StudentSearchRequest, Aluno, DatabricksConfig, DatabricksQueryResult } from '../../types'

/**
 * Cliente para integração com Databricks SQL
 * Usa o Databricks SQL Statement Execution API
 * Docs: https://docs.databricks.com/api/workspace/statementexecution
 */

/**
 * Constrói a query SQL para busca de alunos
 * Baseado na tabela alunos_rematricula conforme PLAN.md
 */
export function buildStudentSearchQuery(searchParams: StudentSearchRequest): string {
  const conditions: string[] = []

  // Busca por código do aluno
  if (searchParams.studentCode) {
    conditions.push(`COD_ALUNO = ${searchParams.studentCode}`)
  }

  // Busca por termo genérico (nome, matrícula)
  if (searchParams.searchTerm) {
    const term = searchParams.searchTerm.toLowerCase()
    conditions.push(`(
      LOWER(NOM_ALUNO) LIKE '%${term}%' OR
      NUM_MATRICULA LIKE '%${term}%'
    )`)
  }

  // Filtro por curso
  if (searchParams.course) {
    conditions.push(`LOWER(NOM_CURSO) LIKE '%${searchParams.course.toLowerCase()}%'`)
  }

  // Filtro por status
  if (searchParams.status) {
    conditions.push(`DSC_STA_MATRICULA = '${searchParams.status}'`)
  }

  // Filtro por marca
  if (searchParams.marca) {
    conditions.push(`LOWER(DSC_MARCA) LIKE '%${searchParams.marca.toLowerCase()}%'`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return `
    SELECT
      COD_ALUNO,
      NUM_MATRICULA,
      DSC_MARCA,
      COD_MARCA,
      SGL_INSTITUICAO,
      SGL_PERIODO_LETIVO,
      NOM_ALUNO,
      NOM_CURSO,
      NOM_TPO_PERSONA,
      DSC_TPO_GRD_CURRICULAR,
      DSC_CATEGORIA_GRADE,
      IND_REG_FINANCEIRO,
      IND_EXECUTOU_LIBERACAO,
      IND_EXECUTOU_PROMOCAO,
      IND_CALOURO,
      IND_MEDICINA,
      COD_CURSO,
      COD_TPO_PERSONA,
      COD_CATEGORIA_GRADE,
      IND_CONFIRMADO_OFERTA_PRINC,
      IND_OFERTA_UCDP,
      IND_OFERTA_CORE,
      QTDE_DP_NA_MAT,
      IND_POSSUI_HORARIO,
      IND_NAO_POSSUI_HORARIO,
      IND_CONTRATO_LIBERADO
    FROM sb_jira.wv_alunos_rem
    ${whereClause}
    ORDER BY NOM_ALUNO ASC
    LIMIT 50
  `.trim()
}

/**
 * Aguarda a conclusão de uma query no Databricks
 */
export async function waitForQueryCompletion(
  host: string,
  token: string,
  statementId: string,
  maxWaitTime = 50000
): Promise<any> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitTime) {
    const response = await fetch(`${host}/api/2.0/sql/statements/${statementId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const data = await response.json()

      if (data.status?.state?.toLowerCase() === 'succeeded') {
        return data
      }

      if (data.status?.state?.toLowerCase() === 'failed') {
        throw new Error(`Query failed in Databricks: ${data.status?.error?.message || 'Unknown error'}`)
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
export function parseStudentResults(data: any): Aluno[] {
  try {
    if (!data?.result?.data_array) {
      console.warn('No data_array in Databricks response')
      return []
    }

    return data.result.data_array.map((row: any[]) => ({
      COD_ALUNO: row[0],
      NUM_MATRICULA: row[1],
      DSC_MARCA: row[2],
      COD_MARCA: row[3],
      SGL_INSTITUICAO: row[4],
      SGL_PERIODO_LETIVO: row[5],
      NOM_ALUNO: row[6],
      NOM_CURSO: row[7],
      NOM_TPO_PERSONA: row[8],
      DSC_TPO_GRD_CURRICULAR: row[9],
      DSC_CATEGORIA_GRADE: row[10],
      IND_REG_FINANCEIRO: row[11],
      IND_EXECUTOU_LIBERACAO: row[12],
      IND_EXECUTOU_PROMOCAO: row[13],
      IND_CALOURO: row[14],
      IND_MEDICINA: row[15],
      COD_CURSO: row[16],
      COD_TPO_PERSONA: row[17],
      COD_CATEGORIA_GRADE: row[18],
      IND_CONFIRMADO_OFERTA_PRINC: row[19],
      IND_OFERTA_UCDP: row[20],
      IND_OFERTA_CORE: row[21],
      QTDE_DP_NA_MAT: row[22],
      IND_POSSUI_HORARIO: row[23],
      IND_NAO_POSSUI_HORARIO: row[24],
      IND_CONTRATO_LIBERADO: row[25]
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
): Promise<any> {
  try {
    console.log(query);

    const response = await fetch(`${config.host}/api/2.0/sql/statements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        statement: query,
        warehouse_id: config.warehouseId,
        catalog: config.catalog,
        schema: config.schema,
        parameters: parameters || {},
        wait_timeout: '50s'
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Databricks query failed:', errorData)
      throw new Error(`Falha na consulta ao Databricks: ${errorData.message || 'Unknown error'}`)
    }

    const data = await response.json()

    // Aguardar conclusão da query se necessário
    const state = data.status?.state?.toLowerCase()
    if (state === 'pending' || state === 'running') {
      return await waitForQueryCompletion(
        config.host,
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
 * Busca alunos no Databricks baseado nos parâmetros de busca
 * Função principal que orquestra todo o processo
 */
export async function searchStudentsInDatabricks(
  config: DatabricksConfig,
  searchParams: StudentSearchRequest,
  userEmail: string
): Promise<Aluno[]> {
  try {
    // 1. Obter token de acesso (Databricks usa Personal Access Token diretamente)
    const token = config.token
    if (!token) {
      throw new Error('Databricks token não configurado')
    }

    // 2. Construir query
    const query = buildStudentSearchQuery(searchParams)

    console.log(`[DATABRICKS] Executing query for user ${userEmail}:`, query.substring(0, 200))

    // 3. Executar query
    const data = await executeQuery(config, token, query)

    // 4. Fazer parse dos resultados
    const students = parseStudentResults(data)

    // 5. Log de auditoria
    console.log(`[AUDIT] ${userEmail} buscou alunos - ${students.length} resultados encontrados`)

    return students
  } catch (error) {
    console.error('Error searching students in Databricks:', error)
    throw error
  }
}

/**
 * Obtém token do Databricks usando Personal Access Token
 * Databricks usa PAT diretamente, não precisa de OAuth flow separado
 */
export async function getDatabricksToken(config: DatabricksConfig): Promise<string | null> {
  try {
    // Databricks usa Personal Access Token (PAT) diretamente
    return config.token
  } catch (error) {
    console.error('Error getting Databricks token:', error)
    return null
  }
}

/**
 * Constrói os parâmetros da query SQL
 */
export function buildQueryParameters(searchParams: StudentSearchRequest): Record<string, any> {
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

  if (searchParams.marca) {
    params.marca = `%${searchParams.marca}%`
  }

  return params
}

/**
 * Obtém a configuração do Databricks baseada nas variáveis de ambiente
 * Função centralizada usada por todos os endpoints
 */
export function getDatabricksConfig(config: any): DatabricksConfig {
  return {
    host: config.databricksHost,
    token: config.databricksToken,
    warehouseId: config.databricksWarehouseId,
    catalog: config.databricksCatalog || 'hive_metastore',
    schema: config.databricksSchema || 'default'
  }
}
