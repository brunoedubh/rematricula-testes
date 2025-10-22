import type { Aluno } from '../../types'
import {
  checkStudentBlockStatus,
  checkMultipleStudentsBlockStatus,
  liberarAluno,
  unlockStudent,
  type StudentBlockStatus
} from '../utils/db_soft'

/**
 * Repository para operações com banco PostgreSQL (Soft Launch)
 * Responsável apenas por gerenciar regras de bloqueio/liberação
 */

/**
 * Verifica o status de bloqueio de um aluno específico
 */
export async function getStudentBlockStatus(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number
): Promise<StudentBlockStatus> {
  return await checkStudentBlockStatus(
    codigocurso,
    identificadorpersona,
    codigocampus,
    codigoperiodoletivo
  )
}

/**
 * Verifica o status de bloqueio de múltiplos alunos
 * Retorna um mapa com a chave sendo o identificador do aluno
 */
export async function getMultipleStudentsBlockStatus(
  students: Aluno[]
): Promise<Map<string, StudentBlockStatus>> {
  return await checkMultipleStudentsBlockStatus(students)
}

/**
 * Libera um aluno no soft launch (cria/atualiza período de liberação)
 */
export async function releaseStudent(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number
): Promise<{ success: boolean; message: string; affectedRows: number }> {
  return await liberarAluno(
    codigocurso,
    identificadorpersona,
    codigocampus,
    codigoperiodoletivo
  )
}

/**
 * Encerra a liberação de um aluno (bloqueia após hoje)
 */
export async function blockStudent(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number
): Promise<{ success: boolean; message: string; affectedRows: number }> {
  return await unlockStudent(
    codigocurso,
    identificadorpersona,
    codigocampus,
    codigoperiodoletivo
  )
}
