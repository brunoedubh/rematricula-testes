export type Environment = 'dev' | 'hml' | 'prod'

export interface EnvironmentConfig {
  clientId: string
  scope: string
  baseUrl: string
}

export interface EnvironmentConfigs {
  dev: EnvironmentConfig
  hml: EnvironmentConfig
  prod: EnvironmentConfig
}

export interface URLGenerationRequest {
  access_token: string
  refresh_token: string
  cod_aluno: string
  environment: Environment
}

export interface URLGenerationResponse {
  url: string
  environment: Environment
}