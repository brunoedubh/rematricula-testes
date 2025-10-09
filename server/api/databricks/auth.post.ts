import type { DatabricksAuthRequest, DatabricksAuthResponse } from '../../../types'
import { getSessionFromEvent } from '../../utils/session'

export default defineEventHandler(async (event): Promise<DatabricksAuthResponse> => {
  try {
    // Verificar se o usuário está autenticado
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Não autenticado'
      })
    }

    const body = await readBody(event) as DatabricksAuthRequest
    const config = useRuntimeConfig()

    // Validação básica
    if (!body.workspace || !body.environment) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Workspace e environment são obrigatórios'
      })
    }

    // Determinar configurações baseadas no ambiente
    const databricksConfig = getDatabricksConfig(body.environment, config)

    if (!databricksConfig) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Configuração do Databricks não encontrada para o ambiente especificado'
      })
    }

    // Fazer autenticação no Databricks
    const databricksToken = await authenticateWithDatabricks(
      databricksConfig,
      session?.encrypted_password || '',
      config.encryptionKey
    )

    if (!databricksToken) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Falha na autenticação com Databricks'
      })
    }

    return {
      success: true,
      token: databricksToken,
      workspace: body.workspace,
      environment: body.environment,
      expires_at: Date.now() + (60 * 60 * 1000) // 1 hora
    }

  } catch (error: any) {
    console.error('Databricks auth error:', error)

    return {
      success: false,
      error: error.statusMessage || error.message || 'Erro interno do servidor'
    }
  }
})

function getDatabricksConfig(environment: string, config: any) {
  switch (environment.toLowerCase()) {
    case 'dev':
      return {
        workspace: config.databricksWorkspaceDev,
        clientId: config.databricksClientIdDev,
        clientSecret: config.databricksClientSecretDev
      }
    case 'prod':
      return {
        workspace: config.databricksWorkspaceProd,
        clientId: config.databricksClientIdProd,
        clientSecret: config.databricksClientSecretProd
      }
    default:
      return null
  }
}

async function authenticateWithDatabricks(
  databricksConfig: any,
  encryptedPassword: string,
  encryptionKey: string
): Promise<string | null> {
  try {
    // Para o Databricks, podemos usar OAuth2 client credentials flow
    // ou personal access tokens dependendo da configuração

    const response = await fetch(`${databricksConfig.workspace}/api/2.0/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${databricksConfig.clientId}:${databricksConfig.clientSecret}`).toString('base64')}`
      },
      body: JSON.stringify({
        lifetime_seconds: 3600, // 1 hora
        comment: 'Token gerado automaticamente via plataforma'
      })
    })

    if (response.ok) {
      const data = await response.json()
      return data.token_value
    }

    const errorData = await response.json()
    console.error('Databricks authentication failed:', errorData)
    return null

  } catch (error) {
    console.error('Error authenticating with Databricks:', error)
    return null
  }
}