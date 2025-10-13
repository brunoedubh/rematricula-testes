/**
 * Sistema de cache de tokens Azure AD
 * Armazena tokens em memória com TTL de 60 minutos
 * Margem de segurança de 5 minutos antes da expiração
 */

interface CachedToken {
  access_token: string
  refresh_token: string
  expires_at: number // Timestamp de expiração
  environment: 'dev' | 'hml' | 'prod'
  created_at: number
}

interface TokenCacheEntry {
  dev?: CachedToken
  hml?: CachedToken
  prod?: CachedToken
}

// Cache em memória: Map<email, TokenCacheEntry>
const tokenCache = new Map<string, TokenCacheEntry>()

// Margem de segurança: 5 minutos antes da expiração
const EXPIRATION_MARGIN = 5 * 60 * 1000 // 5 minutos em ms

/**
 * Salvar token no cache
 */
export function setTokenCache(
  email: string,
  environment: 'dev' | 'hml' | 'prod',
  accessToken: string,
  refreshToken: string,
  expiresIn: number = 3600 // Padrão: 60 minutos
): void {
  const userCache = tokenCache.get(email) || {}

  userCache[environment] = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + (expiresIn * 1000),
    environment,
    created_at: Date.now()
  }

  tokenCache.set(email, userCache)

  console.log(`[TOKEN CACHE] Token ${environment} salvo para ${email} (expira em ${expiresIn}s)`)
}

/**
 * Obter token do cache (se válido)
 * Retorna null se não existir ou estiver expirado
 */
export function getTokenCache(
  email: string,
  environment: 'dev' | 'hml' | 'prod'
): CachedToken | null {
  const userCache = tokenCache.get(email)

  if (!userCache || !userCache[environment]) {
    console.log(`[TOKEN CACHE] Cache MISS para ${email}:${environment} (não existe)`)
    return null
  }

  const token = userCache[environment]!
  const now = Date.now()
  const timeUntilExpiration = token.expires_at - now

  // Verificar se ainda é válido (com margem de segurança)
  if (timeUntilExpiration < EXPIRATION_MARGIN) {
    console.log(`[TOKEN CACHE] Cache MISS para ${email}:${environment} (expirado ou próximo da expiração)`)
    return null
  }

  const minutesRemaining = Math.floor(timeUntilExpiration / 60000)
  console.log(`[TOKEN CACHE] Cache HIT para ${email}:${environment} (válido por mais ${minutesRemaining}min)`)

  return token
}

/**
 * Verificar se um token está válido
 */
export function isTokenValid(
  email: string,
  environment: 'dev' | 'hml' | 'prod'
): boolean {
  return getTokenCache(email, environment) !== null
}

/**
 * Remover tokens de um usuário (usado no logout)
 */
export function clearUserTokens(email: string): void {
  const userCache = tokenCache.get(email)

  if (userCache) {
    const environments = Object.keys(userCache)
    tokenCache.delete(email)
    console.log(`[TOKEN CACHE] Tokens removidos para ${email} (${environments.join(', ')})`)
  }
}

/**
 * Remover token específico de um ambiente
 */
export function clearTokenCache(
  email: string,
  environment: 'dev' | 'hml' | 'prod'
): void {
  const userCache = tokenCache.get(email)

  if (userCache && userCache[environment]) {
    delete userCache[environment]
    tokenCache.set(email, userCache)
    console.log(`[TOKEN CACHE] Token ${environment} removido para ${email}`)
  }
}

/**
 * Obter status dos tokens de um usuário
 */
export function getTokensStatus(email: string): {
  dev: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
  hml: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
  prod: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
} {
  const userCache = tokenCache.get(email) || {}
  const now = Date.now()

  const getStatus = (env: 'dev' | 'hml' | 'prod') => {
    const token = userCache[env]
    if (!token) {
      return { exists: false }
    }

    const timeRemaining = token.expires_at - now
    const isValid = timeRemaining > EXPIRATION_MARGIN

    return {
      exists: true,
      expiresAt: token.expires_at,
      minutesRemaining: isValid ? Math.floor(timeRemaining / 60000) : 0
    }
  }

  return {
    dev: getStatus('dev'),
    hml: getStatus('hml'),
    prod: getStatus('prod')
  }
}

/**
 * Obter estatísticas do cache (para debug)
 */
export function getCacheStats(): {
  totalUsers: number
  totalTokens: number
  users: Array<{
    email: string
    environments: string[]
  }>
} {
  const users: Array<{ email: string; environments: string[] }> = []
  let totalTokens = 0

  tokenCache.forEach((tokens, email) => {
    const environments = Object.keys(tokens)
    totalTokens += environments.length
    users.push({ email, environments })
  })

  return {
    totalUsers: tokenCache.size,
    totalTokens,
    users
  }
}
