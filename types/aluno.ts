export interface Aluno {
  codigo_aluno: string
  nome_completo: string
  email?: string
  cpf: string
  status_matricula: string
  curso: string
  periodo_atual?: string
  data_matricula?: string
  data_nascimento?: string
  telefone?: string
  endereco?: string

  // Campos originais mantidos para compatibilidade
  cod_aluno?: string
  ra?: string
  nome_aluno?: string
  marca?: string
  instituicao?: string
  oferta?: string
  assinou_contrato?: boolean
  matriculado?: boolean
}

export interface SearchFilters {
  marca?: string
  contrato?: boolean
  oferta?: string
}

export interface SearchParams {
  term: string
  filters?: SearchFilters
  page?: number
  limit?: number
}

export interface SearchResponse {
  alunos: Aluno[]
  total: number
  page: number
  totalPages: number
}