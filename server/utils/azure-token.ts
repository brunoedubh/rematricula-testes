/**
 * Gerador de tokens Azure AD com cache inteligente
 * Suporta geração para dev, hml e prod
 */

import { getTokenCache, setTokenCache, isTokenValid } from './token-cache'

interface AzureTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

interface TokenGenerationResult {
  success: boolean
  access_token?: string
  refresh_token?: string
  expires_in?: number
  from_cache: boolean
  minutes_remaining?: number
  error?: string
}

/**
 * Gerar ou reutilizar token do Azure AD
 * Verifica cache primeiro, se não houver ou estiver expirado, gera novo
 */
export async function getOrGenerateToken(
  email: string,
  password: string,
  environment: 'dev' | 'hml' | 'prod'
): Promise<TokenGenerationResult> {
  console.log(`[AZURE TOKEN] Solicitação de token para ${email} em ${environment.toUpperCase()}`)

  // Verificar cache primeiro
  const cachedToken = getTokenCache(email, environment)

  if (cachedToken) {
    const minutesRemaining = Math.floor((cachedToken.expires_at - Date.now()) / 60000)

    return {
      success: true,
      access_token: cachedToken.access_token,
      refresh_token: cachedToken.refresh_token,
      expires_in: Math.floor((cachedToken.expires_at - Date.now()) / 1000),
      from_cache: true,
      minutes_remaining: minutesRemaining
    }
  }

  // Cache miss - gerar novo token
  console.log(`[AZURE TOKEN] Gerando novo token para ${email} em ${environment.toUpperCase()}`)

  try {
    const tokenData = await generateAzureToken(email, password, environment)

    // Salvar no cache
    setTokenCache(
      email,
      environment,
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_in
    )

    return {
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      from_cache: false,
      minutes_remaining: Math.floor(tokenData.expires_in / 60)
    }
  } catch (error: any) {
    console.error(`[AZURE TOKEN] Erro ao gerar token para ${email} em ${environment}:`, error.message)

    return {
      success: false,
      from_cache: false,
      error: error.message || 'Erro ao gerar token'
    }
  }
}

/**
 * Gerar token do Azure AD (sem cache)
 */
async function generateAzureToken(
  email: string,
  password: string,
  environment: 'dev' | 'hml' | 'prod'
): Promise<AzureTokenResponse> {
  const config = useRuntimeConfig()

  // Determinar configurações baseadas no ambiente
  const { clientId, scope, emailSuffix } = getAzureConfig(environment, config)

  if (!clientId || !scope) {
    throw new Error(`Configuração do Azure AD não encontrada para ${environment}`)
  }

  // Construir email completo
  const fullEmail = email.includes('@') ? email : `${email}${emailSuffix}`

  console.log(`[AZURE TOKEN] Fazendo requisição ROPC para ${fullEmail}`)

  // Fazer requisição ROPC para Azure AD
  const response = await fetch('https://login.microsoftonline.com/organizations/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: fullEmail,
      password: password,
      client_id: clientId,
      scope: scope
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error('[AZURE TOKEN] Erro na resposta do Azure AD:', errorData)
    throw new Error(errorData.error_description || 'Falha na autenticação com Azure AD')
  }

  const data = await response.json() as AzureTokenResponse

  if (!data.access_token || !data.refresh_token) {
    throw new Error('Resposta do Azure AD sem tokens')
  }

  console.log(`[AZURE TOKEN] Token gerado com sucesso para ${fullEmail} (expira em ${data.expires_in}s)`)

  return data
}

/**
 * Obter configuração do Azure baseada no ambiente
 */
function getAzureConfig(environment: 'dev' | 'hml' | 'prod', config: any) {
  switch (environment) {
    case 'dev':
    case 'hml':
      return {
        clientId: config.azureClientIdDev,
        scope: config.azureScopeDev,
        emailSuffix: '@homolog.animaeducacao.com.br'
      }
    case 'prod':
      return {
        clientId: config.azureClientIdProd,
        scope: config.azureScopeProd,
        emailSuffix: '@animaeducacao.com.br'
      }
    default:
      throw new Error(`Ambiente inválido: ${environment}`)
  }
}

/**
 * Renovar token usando refresh_token
 * (Para implementação futura)
 */
export async function refreshAzureToken(
  email: string,
  refreshToken: string,
  environment: 'dev' | 'hml' | 'prod'
): Promise<TokenGenerationResult> {
  console.log(`[AZURE TOKEN] Renovando token para ${email} em ${environment.toUpperCase()}`)

  try {
    const config = useRuntimeConfig()
    const { clientId, scope } = getAzureConfig(environment, config)

    const response = await fetch('https://login.microsoftonline.com/organizations/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        scope: scope
      })
    })

    if (!response.ok) {
      throw new Error('Falha ao renovar token')
    }

    const data = await response.json() as AzureTokenResponse

    // Salvar novo token no cache
    setTokenCache(
      email,
      environment,
      data.access_token,
      data.refresh_token,
      data.expires_in
    )

    return {
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      from_cache: false,
      minutes_remaining: Math.floor(data.expires_in / 60)
    }
  } catch (error: any) {
    console.error(`[AZURE TOKEN] Erro ao renovar token:`, error.message)

    return {
      success: false,
      from_cache: false,
      error: error.message || 'Erro ao renovar token'
    }
  }
}

/**
 * Gerar tokens para múltiplos ambientes (usado no login)
 * Gera de forma assíncrona para dev e hml
 */
export async function generateTokensForEnvironments(
  email: string,
  password: string,
  environments: Array<'dev' | 'hml'>
): Promise<void> {
  console.log(`[AZURE TOKEN] Gerando tokens em background para ${email}: ${environments.join(', ')}`)

  // Gerar tokens de forma assíncrona (não bloqueia)
  const promises = environments.map(env =>
    getOrGenerateToken(email, password, env)
      .then(result => {
        if (result.success) {
          console.log(`[AZURE TOKEN] Token ${env.toUpperCase()} gerado com sucesso em background`)
        } else {
          console.error(`[AZURE TOKEN] Erro ao gerar token ${env.toUpperCase()} em background:`, result.error)
        }
      })
      .catch(error => {
        console.error(`[AZURE TOKEN] Exceção ao gerar token ${env} em background:`, error)
      })
  )

  // Não esperar - executar em background
  Promise.allSettled(promises)
}
