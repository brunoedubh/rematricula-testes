import type { StudentSearchRequest, Aluno, DatabricksConfig, DatabricksQueryResult } from '../../types'

/**
 * Cliente para integração com Databricks SQL
 * Usa o Databricks SQL Statement Execution API
 * Docs: https://docs.databricks.com/api/workspace/statementexecution
 */

/**
 * Escapa caracteres especiais para prevenir SQL Injection
 * Remove caracteres perigosos e escapa aspas simples
 */
function sanitizeString(input: string): string {
  // Remove caracteres perigosos e escapa aspas simples
  return input
    .replace(/'/g, "''")  // Escapa aspas simples (padrão SQL)
    .replace(/;/g, '')     // Remove ponto e vírgula
    .replace(/--/g, '')    // Remove comentários SQL
    .replace(/\/\*/g, '')  // Remove início de comentário de bloco
    .replace(/\*\//g, '')  // Remove fim de comentário de bloco
    .replace(/xp_/gi, '')  // Remove comandos extended stored procedures
}

/**
 * Valida e sanitiza um número inteiro
 * Retorna null se inválido
 */
function sanitizeNumber(input: string | number | undefined): number | null {
  if (input === undefined || input === null || input === '') {
    return null
  }

  const num = typeof input === 'string' ? parseInt(input, 10) : input

  // Valida se é um número válido e não é NaN
  if (isNaN(num) || !isFinite(num)) {
    return null
  }

  return num
}

/**
 * Constrói a query SQL para busca de alunos de forma segura
 * Baseado na tabela alunos_rematricula conforme PLAN.md
 * Usa sanitização para prevenir SQL Injection
 */
export function buildStudentSearchQuery(searchParams: StudentSearchRequest): string {
  const conditions: string[] = []

  // Busca por código do aluno (validar que é número)
  if (searchParams.studentCode) {
    const code = sanitizeNumber(searchParams.studentCode)
    if (code !== null) {
      conditions.push(`COD_ALUNO = ${code}`)
    }
  }

  // Busca por RA (string numérica, pode ter zeros à esquerda)
  if (searchParams.studentRA) {
    // Validar que contém apenas dígitos
    const ra = searchParams.studentRA.toString().trim()
    if (/^\d+$/.test(ra) && ra.length > 0 && ra.length <= 20) {
      conditions.push(`NUM_MATRICULA = '${ra}'`)
    }
  }

  // Busca por termo genérico (nome, CPF) - sanitizar string
  if (searchParams.searchTerm) {
    const term = sanitizeString(searchParams.searchTerm.toLowerCase())
    // Limitar tamanho do termo para evitar ataques de DoS
    if (term.length > 0 && term.length <= 100) {
      conditions.push(`(
        LOWER(NOM_ALUNO) LIKE '%${term}%' OR
        NUM_CPF LIKE '%${term}%'
      )`)
    }
  }

  // Filtro por curso - sanitizar string
  if (searchParams.course) {
    const course = sanitizeString(searchParams.course.toLowerCase())
    if (course.length > 0 && course.length <= 100) {
      conditions.push(`LOWER(NOM_CURSO) LIKE '%${course}%'`)
    }
  }

  // Filtro por status - sanitizar string
  if (searchParams.status) {
    const status = sanitizeString(searchParams.status)
    if (status.length > 0 && status.length <= 50) {
      conditions.push(`DSC_STA_MATRICULA = '${status}'`)
    }
  }

  // Filtro por marca (validar que é número)
  if (searchParams.marca) {
    const marca = sanitizeNumber(searchParams.marca)
    if (marca !== null) {
      conditions.push(`COD_MARCA = ${marca}`)
    }
  }

  // Filtro por categoria de grade (validar que é número)
  if (searchParams.categoriaGrade) {
    const categoria = sanitizeNumber(searchParams.categoriaGrade)
    if (categoria !== null) {
      conditions.push(`COD_CATEGORIA_GRADE = ${categoria}`)
    }
  }

  // Filtro por persona (validar que é número)
  if (searchParams.persona) {
    const persona = sanitizeNumber(searchParams.persona)
    if (persona !== null) {
      conditions.push(`COD_TPO_PERSONA = ${persona}`)
    }
  }

  if (searchParams.IND_CONTRATO_ASSINADO) {
    const indcontassinado = searchParams.IND_CONTRATO_ASSINADO
    if (indcontassinado === true || indcontassinado === false) {
      conditions.push(`IND_CONTRATO_ASSINADO = ${indcontassinado}`)
    }
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
      COD_PERIODO_LETIVO,
      NOM_ALUNO,
      NOM_CURSO,
      COD_CAMPUS,
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
      IND_CONTRATO_LIBERADO,
      IND_CONTRATO_ASSINADO,
      NUM_CPF
    FROM sb_jira.wv_alunos_rem
    ${whereClause}
    ORDER BY NOM_ALUNO ASC
    LIMIT 10
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
      COD_PERIODO_LETIVO: row[6],
      NOM_ALUNO: row[7],
      NOM_CURSO: row[8],
      COD_CAMPUS: row[9],
      NOM_TPO_PERSONA: row[10],
      DSC_TPO_GRD_CURRICULAR: row[11],
      DSC_CATEGORIA_GRADE: row[12],
      IND_REG_FINANCEIRO: row[13],
      IND_EXECUTOU_LIBERACAO: row[14],
      IND_EXECUTOU_PROMOCAO: row[15],
      IND_CALOURO: row[16],
      IND_MEDICINA: row[17],
      COD_CURSO: row[18],
      COD_TPO_PERSONA: row[19],
      COD_CATEGORIA_GRADE: row[20],
      IND_CONFIRMADO_OFERTA_PRINC: row[21],
      IND_OFERTA_UCDP: row[22],
      IND_OFERTA_CORE: row[23],
      QTDE_DP_NA_MAT: row[24],
      IND_POSSUI_HORARIO: row[25],
      IND_NAO_POSSUI_HORARIO: row[26],
      IND_CONTRATO_LIBERADO: row[27],
      IND_CONTRATO_ASSINADO: row[28],
      NUM_CPF: row[29]
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

  if (searchParams.studentRA) {
    params.studentRA = searchParams.studentRA
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
    params.marca = searchParams.marca
  }

  if (searchParams.persona) {
    params.persona = searchParams.persona
  }

  if (searchParams.categoriaGrade) {
    params.categoriaGrade = searchParams.categoriaGrade
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
