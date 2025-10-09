export interface DatabricksAuthRequest {
  workspace: string
  environment: 'dev' | 'prod'
}

export interface DatabricksAuthResponse {
  success: boolean
  token?: string
  workspace?: string
  environment?: string
  expires_at?: number
  error?: string
}

export interface StudentSearchRequest {
  studentCode?: string
  searchTerm?: string
  course?: string
  status?: string
  environment?: 'dev' | 'prod'
}

export interface StudentSearchResponse {
  success: boolean
  students: import('./aluno').Aluno[]
  total: number
  searchTerm?: string
  studentCode?: string
  error?: string
}

export interface DatabricksConfig {
  workspace: string
  clientId: string
  clientSecret: string
  warehouseId?: string
}

export interface DatabricksTokenResponse {
  token_value: string
  token_info: {
    token_id: string
    creation_time: number
    expiry_time: number
    comment: string
  }
}

export interface DatabricksQueryRequest {
  statement: string
  warehouse_id: string
  catalog?: string
  schema?: string
  parameters?: Record<string, any>
}

export interface DatabricksQueryResponse {
  statement_id: string
  state: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  result?: {
    data_array?: any[][]
    columns?: Array<{
      name: string
      type: string
    }>
  }
  error?: any
}