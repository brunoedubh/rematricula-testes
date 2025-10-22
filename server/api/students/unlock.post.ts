import { getSessionFromEvent } from '../../utils/session'
import { blockStudent } from '../../repositories/softLaunchRepository'

interface UnlockStudentRequest {
  codigocurso: number
  identificadorpersona: number
  codigocampus: number
  codigoperiodoletivo: number
}

interface UnlockStudentResponse {
  success: boolean
  message: string
  affectedRows?: number
  error?: string
}

export default defineEventHandler(async (event): Promise<UnlockStudentResponse> => {
  try {
    // Verificar se o usuário está autenticado
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        message: 'Não autenticado'
      })
    }

    const body = await readBody(event) as UnlockStudentRequest

    // Validação dos parâmetros obrigatórios
    if (!body.codigocurso || !body.identificadorpersona || !body.codigocampus || !body.codigoperiodoletivo) {
      throw createError({
        statusCode: 400,
        message: 'Parâmetros obrigatórios ausentes: codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo'
      })
    }

    // Log de auditoria
    console.log(`[AUDIT] ${session.email} desbloqueando aluno - Curso: ${body.codigocurso}, Persona: ${body.identificadorpersona}, Campus: ${body.codigocampus}, Período: ${body.codigoperiodoletivo}`)

    // Encerrar liberação (bloquear após hoje) usando repository
    const result = await blockStudent(
      body.codigocurso,
      body.identificadorpersona,
      body.codigocampus,
      body.codigoperiodoletivo
    )

    if (result.success) {
      console.log(`[AUDIT] ${session.email} desbloqueou aluno com sucesso - ${result.affectedRows} registro(s) atualizado(s)`)
    }

    return result

  } catch (error: any) {
    console.error('Unlock student error:', error)

    return {
      success: false,
      message: 'Erro ao desbloquear aluno',
      error: error.message || 'Erro interno do servidor'
    }
  }
})
