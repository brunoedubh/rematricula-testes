import { getSessionFromEvent } from '../../utils/session'
import { releaseStudent } from '../../repositories/softLaunchRepository'

interface LiberarStudentRequest {
  codigocurso: number
  identificadorpersona: number
  codigocampus: number
  codigoperiodoletivo: number
}

interface LiberarStudentResponse {
  success: boolean
  message: string
  affectedRows?: number
  error?: string
}

export default defineEventHandler(async (event): Promise<LiberarStudentResponse> => {
  try {
    // Verificar se o usuário está autenticado
    const session = await getSessionFromEvent(event)
    if (!session) {
      throw createError({
        statusCode: 401,
        message: 'Não autenticado'
      })
    }

    const body = await readBody(event) as LiberarStudentRequest

    // Validação dos parâmetros obrigatórios
    if (!body.codigocurso || !body.identificadorpersona || !body.codigocampus || !body.codigoperiodoletivo) {
      throw createError({
        statusCode: 400,
        message: 'Parâmetros obrigatórios ausentes: codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo'
      })
    }

    // Log de auditoria
    console.log(`[AUDIT] ${session.email} liberando aluno - Curso: ${body.codigocurso}, Persona: ${body.identificadorpersona}, Campus: ${body.codigocampus}, Período: ${body.codigoperiodoletivo}`)

    // Liberar aluno usando repository
    const result = await releaseStudent(
      body.codigocurso,
      body.identificadorpersona,
      body.codigocampus,
      body.codigoperiodoletivo
    )

    if (result.success) {
      console.log(`[AUDIT] ${session.email} liberou aluno com sucesso - ${result.affectedRows} registro(s) afetado(s)`)
    }

    return result

  } catch (error: any) {
    console.error('Liberar student error:', error)

    return {
      success: false,
      message: 'Erro ao liberar aluno',
      error: error.message || 'Erro interno do servidor'
    }
  }
})
