import type { Aluno } from '../../types'
import {
  checkStudentBlockStatus,
  checkMultipleStudentsBlockStatus,
  liberarAluno,
  unlockStudent,
  lerEscopoRegra,
  restaurarEscopoRegra,
  type StudentBlockStatus,
  type EscopoRegraAnterior
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

/**
 * Lê o estado da regra de liberação da combinação (usado pela esteira do e2e antes de liberar)
 */
export async function lerEscopo(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number
): Promise<EscopoRegraAnterior> {
  return await lerEscopoRegra(codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo)
}

/**
 * Volta a combinação ao estado lido por lerEscopo (apaga a linha criada ou restaura o datafim)
 */
export async function restaurarEscopo(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number,
  anterior: EscopoRegraAnterior
): Promise<number> {
  return await restaurarEscopoRegra(codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo, anterior)
}
