import type { Environment } from './environment'

export interface AzureTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface CachedToken {
  access_token: string
  refresh_token: string
  expires_at: number
  environment: Environment
  user_email: string
}

export interface TokenGenerationRequest {
  cod_aluno: string
  environment: Environment
}

export interface TokenGenerationResponse {
  url: string
  token_status: 'cached' | 'new' | 'renewed'
  expires_in_minutes: number
}