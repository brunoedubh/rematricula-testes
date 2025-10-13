/**
 * Construtor de URLs para diferentes ambientes
 * Gera URLs completas para acesso com tokens
 */

/**
 * Construir URL completa para acessar ambiente com token
 */
export function buildAccessUrl(
  environment: 'dev' | 'hml' | 'prod',
  accessToken: string,
  refreshToken: string,
  studentCode: string
): string {
  const config = useRuntimeConfig()

  const baseUrl = getBaseUrl(environment, config)

  // Padrão de URL: /rematricula/autorizacao-idp/token/{access_token}/{refresh_token}/{cod_aluno}
  const url = `${baseUrl}/autorizacao-idp/token/${accessToken}/${refreshToken}/${studentCode}`

  console.log(`[URL BUILDER] URL gerada para ${environment.toUpperCase()}: ${url.substring(0, 80)}...`)

  return url
}

/**
 * Obter URL base do ambiente
 */
function getBaseUrl(environment: 'dev' | 'hml' | 'prod', config: any): string {
  switch (environment) {
    case 'dev':
      return config.urlBaseDev || 'https://cloudapp-dev.animaeducacao.com.br/rematricula'
    case 'hml':
      return config.urlBaseHml || 'https://cloudapp-hml.animaeducacao.com.br/rematricula'
    case 'prod':
      return config.urlBaseProd || 'https://cloudapp.animaeducacao.com.br/rematricula'
    default:
      throw new Error(`Ambiente inválido: ${environment}`)
  }
}

/**
 * Validar código do aluno
 */
export function validateStudentCode(studentCode: string): boolean {
  // Código do aluno deve ser numérico
  return /^\d+$/.test(studentCode)
}
