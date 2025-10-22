/**
 * Interface do Aluno baseada na tabela alunos_rematricula do Databricks
 * Conforme especificado no PLAN.md linha 379-426
 */
export interface Aluno {
  // Identificação
  COD_ALUNO: number
  NUM_MATRICULA: string
  NUM_CPF?: string
  NOM_ALUNO: string

  // Instituição e Marca
  DSC_MARCA: string
  COD_MARCA: number
  SGL_INSTITUICAO: string
  SGL_PERIODO_LETIVO: string

  // Curso e Disciplina
  COD_CURSO: number
  NOM_CURSO: string
  NOM_DISCIPLINA?: string
  COD_CAMPUS: number

  // Status
  DSC_STA_MATRICULA: string
  COD_STA_MATRICULA: number

  // Tipo de Disciplina e Grade
  DSC_TPO_DISCIPLINA?: string
  COD_TPO_DISCIPLINA?: number
  DSC_CRG_HORARIA?: string
  DSC_TPO_GRD_CURRICULAR?: string
  DSC_CATEGORIA_GRADE?: string
  COD_CATEGORIA_GRADE?: number

  // Persona e Liberação
  NOM_TPO_PERSONA?: string
  COD_TPO_PERSONA?: number
  DSC_TPO_LIBERACAO?: string
  COD_TPO_LIBERACAO?: number

  // Indicadores de Oferta Principal
  IND_CONFIRMADO_OFERTA_PRINC?: string

  // Indicadores UCDP
  IND_OFERTA_UCDP?: string
  IND_CONFIRMADO_UCDP?: string
  IND_UCDP_NA_MAT?: string

  // Indicadores Core Curriculum
  IND_OFERTA_CORE?: string
  IND_CONFIRMADO_CORE?: string
  IND_NAO_CONFIRMADO_CORE?: string
  IND_CORE_CURRICULUM_NA_MAT?: string

  // Indicadores Pendência Acadêmica E2A2
  IND_NAO_CONFI_PEND_ACAD_E2A2?: string
  IND_CONFIRMADO_PEND_ACAD_E2A2?: string
  IND_PEND_ACAD_E2A2_LIBERADA?: string

  // Dependências (DP)
  QTDE_DP_NA_MAT?: number
  QTDE_DP_CONFIRMADA?: number
  QTDE_DP_CONFIRMADA_PRODUTO?: number

  // Indicadores de Processo
  IND_EXECUTOU_LIBERACAO?: string
  IND_EXECUTOU_PROMOCAO?: string
  IND_POSSUI_HORARIO?: string
  IND_NAO_POSSUI_HORARIO?: string

  // Indicadores Financeiros e Contratuais
  IND_CONTRATO_LIBERADO?: string
  IND_REG_FINANCEIRO?: string
  IND_CONTRATO_ASSINADO?: boolean

  // Indicadores Especiais
  IND_CALOURO?: string
  IND_MEDICINA?: string
  PERIODO_LETIVO_ENTRADA?: string

  // Campos adicionais (opcionais, para compatibilidade)
  email?: string
  data_nascimento?: string
  periodo_atual?: string

  // Campos de bloqueio (Soft Launch)
  bloqueado?: boolean
  dataFimBloqueio?: string
  COD_PERIODO_LETIVO?: number
}

/**
 * Filtros de busca de alunos
 */
export interface SearchFilters {
  marca?: string
  contrato?: boolean
  oferta?: string
  status?: string
  curso?: string
  bloqueado?: 'bloqueados' | 'desbloqueados' | 'todos'
}

/**
 * Parâmetros de busca
 */
export interface SearchParams {
  term: string
  filters?: SearchFilters
  page?: number
  limit?: number
}

/**
 * Resposta da busca com paginação
 */
export interface SearchResponse {
  alunos: Aluno[]
  total: number
  page: number
  totalPages: number
}
