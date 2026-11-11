/**
 * API para gerar URL de acesso com token
 * POST /api/tokens/generate-url
 *
 * Body:
 * {
 *   studentCode: string
 *   environment: 'dev' | 'hml' | 'prod'
 *   password?: string  // Obrigatório apenas para prod
 * }
 */

import type { H3Event } from 'h3'
import { getSessionFromEvent, salvarSenhaNaSessao } from '../../utils/session'
import { getOrGenerateToken, getOrRefreshToken } from '../../utils/azure-token'
import { buildAccessUrl, validateStudentCode } from '../../utils/url-builder'
import { decrypt, encrypt } from '../../utils/encryption'

interface GenerateUrlRequest {
  studentCode: string
  environment: 'dev' | 'hml' | 'prod'
  password?: string // Obrigatório para prod, opcional para dev/hml quando sessão expirou
}

interface GenerateUrlResponse {
  success: boolean
  url?: string
  from_cache?: boolean
  minutes_remaining?: number
  environment?: string
  error?: string
  requiresPassword?: boolean
}

export default defineEventHandler(async (event: H3Event): Promise<GenerateUrlResponse> => {
  try {
    // Verificar autenticação
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        message: 'Não autenticado'
      })
    }

    const body = await readBody(event) as GenerateUrlRequest
    const config = useRuntimeConfig()

    // Validação básica
    if (!body.studentCode || !body.environment) {
      throw createError({
        statusCode: 400,
        message: 'Código do aluno e ambiente são obrigatórios'
      })
    }

    // Validar código do aluno
    if (!validateStudentCode(body.studentCode)) {
      throw createError({
        statusCode: 400,
        message: 'Código do aluno deve ser numérico'
      })
    }

    let tokenResult

    if (body.environment === 'prod') {
      // Para produção, senha é obrigatória
      if (!body.password) {
        throw createError({
          statusCode: 400,
          message: 'Senha é obrigatória para acesso ao ambiente de produção'
        })
      }
      tokenResult = await getOrGenerateToken(session.email, body.password, 'prod')
    } else {
      // DEV/HML: a senha só é pedida quando não há token válido nem refresh token que renove
      // (getOrRefreshToken). Senha da sessão ou informada agora; a informada fica guardada na sessão.
      const password = body.password
        || (session.encrypted_password ? decrypt(session.encrypted_password, config.encryptionKey) : undefined)
      tokenResult = await getOrRefreshToken(session.email, body.environment, password)

      if (tokenResult.requiresPassword) {
        // Resposta normal (não erro HTTP) para que o frontend possa pedir a senha
        return { success: false, error: tokenResult.error, requiresPassword: true }
      }
      if (tokenResult.success && body.password) {
        salvarSenhaNaSessao(event, encrypt(body.password, config.encryptionKey))
      }
    }

    if (!tokenResult.success) {
      throw createError({
        statusCode: 500,
        message: tokenResult.error || 'Erro ao gerar token'
      })
    }

    // Construir URL completa
    const url = buildAccessUrl(
      body.environment,
      tokenResult.access_token!,
      tokenResult.refresh_token!,
      body.studentCode
    )

    // Log de auditoria
    console.log(
      `[AUDIT] ${session.email} gerou URL para aluno ${body.studentCode} em ${body.environment.toUpperCase()} ` +
      `(cache: ${tokenResult.from_cache}, válido por ${tokenResult.minutes_remaining}min)`
    )

    return {
      success: true,
      url,
      from_cache: tokenResult.from_cache,
      minutes_remaining: tokenResult.minutes_remaining,
      environment: body.environment
    }

  } catch (error) {
    console.error('Generate URL error:', error)

    return {
      success: false,
      error: (error instanceof Error ? error.message : 'Erro ao gerar URL')
    }
  }
})
