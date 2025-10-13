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
import { getSessionFromEvent } from '../../utils/session'
import { getOrGenerateToken } from '../../utils/azure-token'
import { buildAccessUrl, validateStudentCode } from '../../utils/url-builder'
import { decrypt } from '../../utils/encryption'

interface GenerateUrlRequest {
  studentCode: string
  environment: 'dev' | 'hml' | 'prod'
  password?: string // Obrigatório para prod
}

interface GenerateUrlResponse {
  success: boolean
  url?: string
  from_cache?: boolean
  minutes_remaining?: number
  environment?: string
  error?: string
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

    // Para produção, senha é obrigatória
    if (body.environment === 'prod' && !body.password) {
      throw createError({
        statusCode: 400,
        message: 'Senha é obrigatória para acesso ao ambiente de produção'
      })
    }

    // Determinar senha a usar
    let password: string

    if (body.environment === 'prod') {
      // Para produção, usar senha fornecida pelo usuário
      password = body.password!
    } else {
      // Para dev/hml, usar senha descriptografada da sessão
      password = decrypt(session.encrypted_password, config.encryptionKey)
    }

    // Gerar ou obter token do cache
    const tokenResult = await getOrGenerateToken(
      session.email,
      password,
      body.environment
    )

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

  } catch (error: any) {
    console.error('Generate URL error:', error)

    return {
      success: false,
      error: error.message || 'Erro ao gerar URL'
    }
  }
})
