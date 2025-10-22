import { getSessionFromEvent } from '../../utils/session'
import { getStudentBlockStatus } from '../../repositories/softLaunchRepository'

interface BlockStatusRequest {
  codigocurso: number
  identificadorpersona: number
  codigocampus: number
  codigoperiodoletivo: number
}

interface BlockStatusResponse {
  success: boolean
  bloqueado?: boolean
  dataFimBloqueio?: string
  error?: string
}

/**
 * Endpoint para verificar status de bloqueio de um aluno específico
 * Busca apenas dados do PostgreSQL (soft launch)
 * Chamado apenas quando necessário (ex: ao abrir modal de detalhes)
 */
export default defineEventHandler(async (event): Promise<BlockStatusResponse> => {
  try {
    // Verificar se o usuário está autenticado
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        message: 'Não autenticado'
      })
    }

    const body = await readBody(event) as BlockStatusRequest

    // Validação dos parâmetros obrigatórios
    if (!body.codigocurso || !body.identificadorpersona || !body.codigocampus || !body.codigoperiodoletivo) {
      throw createError({
        statusCode: 400,
        message: 'Parâmetros obrigatórios ausentes: codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo'
      })
    }

    // Buscar status de bloqueio no PostgreSQL
    const blockStatus = await getStudentBlockStatus(
      body.codigocurso,
      body.identificadorpersona,
      body.codigocampus,
      body.codigoperiodoletivo
    )

    return {
      success: true,
      bloqueado: blockStatus.bloqueado,
      dataFimBloqueio: blockStatus.dataFimBloqueio
    }

  } catch (error: any) {
    console.error('Block status error:', error)

    return {
      success: false,
      error: error.message || 'Erro ao verificar status de bloqueio'
    }
  }
})
