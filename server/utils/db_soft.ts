import { Pool } from 'pg'
import type { Aluno } from '../../types'

let pool: Pool | null = null

export const getDb = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_SOFT_HOST,
      port: parseInt(process.env.DB_SOFT_PORT || '5432'),
      database: process.env.DB_SOFT_NAME,
      user: process.env.DB_SOFT_USER,
      password: process.env.DB_SOFT_PASSWORD,
      ssl: process.env.DB_SOFT_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20, // número máximo de conexões no pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      options: `-c search_path=${process.env.DB_SOFT_SCHEMA || 'public'}`
    })
  }
  return pool
}

/**
 * Interface para o resultado da verificação de bloqueio
 */
export interface StudentBlockStatus {
  bloqueado: boolean
  dataFimBloqueio?: string
}

/**
 * Verifica se um aluno está bloqueado baseado nas regras da tabela escopo_regra
 *
 * LÓGICA: A tabela escopo_regra representa LIBERAÇÃO/PERMISSÃO (soft launch)
 * - Se o aluno NÃO tem registro na tabela: BLOQUEADO (não está liberado)
 * - Se tem registro MAS fora do período (data atual fora do range): BLOQUEADO
 * - Se tem registro E dentro do período (datainicio <= hoje <= datafim): DESBLOQUEADO (liberado)
 *
 * Condições de liberação:
 * - COD_CURSO = codigocurso
 * - COD_TPO_PERSONA = identificadorpersona
 * - COD_CAMPUS = codigocampus
 * - COD_PERIODO_LETIVO = codigoperiodoletivo
 * - codigonivelcurso = 1
 * - datainicio <= data atual e datafim >= data atual
 * - codigoregra = 'a511dd31-b291-4b09-a94f-52e95936d418'
 */
export async function checkStudentBlockStatus(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number
): Promise<StudentBlockStatus> {
  const db = getDb()

  try {
    const result = await db.query(`
      SELECT datafim
      FROM escopo_regra
      WHERE codigocurso = $1
        AND identificadorpersona = $2
        AND codigocampus = $3
        AND codigoperiodoletivo = $4
        AND codigonivelcurso = 1
        AND codigoregra = 'a511dd31-b291-4b09-a94f-52e95936d418'
        AND datainicio <= CURRENT_TIMESTAMP
        AND datafim >= CURRENT_TIMESTAMP
      LIMIT 1
    `, [codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo])

    // Se encontrou registro dentro do período = aluno está LIBERADO (desbloqueado)
    if (result.rows.length > 0) {
      return {
        bloqueado: false, // DESBLOQUEADO - tem permissão ativa
        dataFimBloqueio: result.rows[0].datafim
      }
    }

    // Se não encontrou registro = aluno está BLOQUEADO (sem permissão)
    return {
      bloqueado: true // BLOQUEADO - não tem permissão
    }
  } catch (error) {
    console.error('Erro ao verificar status de bloqueio:', error)
    // Em caso de erro, considerar bloqueado por segurança
    return {
      bloqueado: true
    }
  }
}

/**
 * Verifica o status de bloqueio de múltiplos alunos de uma vez
 * Retorna um mapa com a chave sendo o identificador do aluno e o valor o status de bloqueio
 */
export async function checkMultipleStudentsBlockStatus(
  students: Aluno[]
): Promise<Map<string, StudentBlockStatus>> {
  const db = getDb()
  const statusMap = new Map<string, StudentBlockStatus>()

  if (students.length === 0) {
    return statusMap
  }

  try {
    // Criar uma lista de valores para a query
    const values: any[] = []
    const conditions: string[] = []

    students.forEach((student, index) => {
      const baseIndex = index * 4
      conditions.push(`(
        codigocurso = $${baseIndex + 1} AND
        identificadorpersona = $${baseIndex + 2} AND
        codigocampus = $${baseIndex + 3} AND
        codigoperiodoletivo = $${baseIndex + 4}
      )`)
      values.push(
        student.COD_CURSO,
        student.COD_TPO_PERSONA,
        student.COD_CAMPUS,
        student.COD_PERIODO_LETIVO
      )
    })

    const query = `
      SELECT
        codigocurso,
        identificadorpersona,
        codigocampus,
        codigoperiodoletivo,
        datafim
      FROM escopo_regra
      WHERE (${conditions.join(' OR ')})
        AND codigonivelcurso = 1
        AND codigoregra = 'a511dd31-b291-4b09-a94f-52e95936d418'
        AND datainicio <= CURRENT_TIMESTAMP
        AND datafim >= CURRENT_TIMESTAMP
      ORDER BY datafim DESC
    `

    console.log('[checkMultipleStudentsBlockStatus] Query:', query)
    console.log('[checkMultipleStudentsBlockStatus] Values:', values)

    const result = await db.query(query, values)

    // Criar mapa com as LIBERAÇÕES encontradas (alunos com permissão ativa)
    const unlockedStudents = new Map<string, string>()
    result.rows.forEach((row: any) => {
      const key = `${row.codigocurso}-${row.identificadorpersona}-${row.codigocampus}-${row.codigoperiodoletivo}`
      if (!unlockedStudents.has(key)) {
        unlockedStudents.set(key, row.datafim)
      }
    })

    console.log('[checkMultipleStudentsBlockStatus] Unlocked students:', unlockedStudents.size)

    // Preencher o mapa de status para todos os alunos
    // LÓGICA INVERTIDA: Se TEM no mapa = DESBLOQUEADO, se NÃO TEM = BLOQUEADO
    students.forEach((student) => {
      const key = `${student.COD_CURSO}-${student.COD_TPO_PERSONA}-${student.COD_CAMPUS}-${student.COD_PERIODO_LETIVO}`
      if (unlockedStudents.has(key)) {
        // Aluno tem permissão ativa = DESBLOQUEADO
        statusMap.set(key, {
          bloqueado: false,
          dataFimBloqueio: unlockedStudents.get(key)
        })
      } else {
        // Aluno NÃO tem permissão = BLOQUEADO
        statusMap.set(key, {
          bloqueado: true
        })
      }
    })

    return statusMap
  } catch (error) {
    console.error('Erro ao verificar status de bloqueio de múltiplos alunos:', error)
    // Em caso de erro, retornar todos como BLOQUEADOS por segurança
    students.forEach((student) => {
      const key = `${student.COD_CURSO}-${student.COD_TPO_PERSONA}-${student.COD_CAMPUS}-${student.COD_PERIODO_LETIVO}`
      statusMap.set(key, { bloqueado: true })
    })
    return statusMap
  }
}

/**
 * LIBERA um aluno criando/atualizando um registro de permissão no soft launch
 * Cria um período de liberação de 30 dias a partir de hoje
 */
export async function liberarAluno(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number
): Promise<{ success: boolean; message: string; affectedRows: number }> {
  const db = getDb()

  try {
    // Verificar se já existe um registro
    const checkResult = await db.query(`
      SELECT COUNT(*) as count
      FROM escopo_regra
      WHERE codigocurso = $1
        AND identificadorpersona = $2
        AND codigocampus = $3
        AND codigoperiodoletivo = $4
        AND codigonivelcurso = 1
        AND codigoregra = 'a511dd31-b291-4b09-a94f-52e95936d418'
    `, [codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo])

    const hasRecord = checkResult.rows[0].count > 0

    let result

    if (hasRecord) {
      // Atualizar registro existente
      result = await db.query(`
        UPDATE escopo_regra
        SET datafim = CURRENT_TIMESTAMP + interval '23 hours 59 minutes'
        WHERE codigocurso = $1
          AND identificadorpersona = $2
          AND codigocampus = $3
          AND codigoperiodoletivo = $4
          AND codigonivelcurso = 1
          AND codigoregra = 'a511dd31-b291-4b09-a94f-52e95936d418'
      `, [codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo])
    } else {
      // Criar novo registro
      result = await db.query(`
        INSERT INTO escopo_regra (
          codigocurso,
          identificadorpersona,
          codigoregra,
          codigocampus,
          datainicio,
          datafim,
          indicadore2a2,
          codigogruposoftlaunch,
          codigonivelcurso,
          codigoperiodoletivo
        ) VALUES (
          $1, $2, 'a511dd31-b291-4b09-a94f-52e95936d418', $3,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP + interval '23 hours 59 minutes',
          true, nextval('servicorematriculaadministrativo.s_grupo_soft_launch'), 1, $4
        )
      `, [codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo])
    }

    console.log('[liberarAluno] Rows affected:', result.rowCount)

    if (result.rowCount && result.rowCount > 0) {
      return {
        success: true,
        message: `Aluno liberado com sucesso! Período de liberação: 1 dia (${hasRecord ? 'atualizado' : 'criado'})`,
        affectedRows: result.rowCount
      }
    } else {
      return {
        success: false,
        message: 'Não foi possível liberar o aluno',
        affectedRows: 0
      }
    }
  } catch (error) {
    console.error('Erro ao liberar aluno:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao liberar aluno',
      affectedRows: 0
    }
  }
}

/**
 * Desbloqueia um aluno ENCERRANDO o período de liberação (datafim = hoje 23:59)
 * Isso faz com que o aluno saia do soft launch e fique bloqueado
 *
 * IMPORTANTE: Depois que datafim passa, o aluno fica BLOQUEADO novamente,
 * pois não estará mais dentro do período de liberação
 */
export async function unlockStudent(
  codigocurso: number,
  identificadorpersona: number,
  codigocampus: number,
  codigoperiodoletivo: number
): Promise<{ success: boolean; message: string; affectedRows: number }> {
  const db = getDb()

  try {
    // Atualizar datafim para hoje às 23:59:00
    // Isso encerra a liberação no final do dia de hoje
    const result = await db.query(`
      UPDATE escopo_regra
      SET datafim = date_trunc('day', CURRENT_TIMESTAMP) + interval '23 hours 59 minutes'
      WHERE codigocurso = $1
        AND identificadorpersona = $2
        AND codigocampus = $3
        AND codigoperiodoletivo = $4
        AND codigonivelcurso = 1
        AND codigoregra = 'a511dd31-b291-4b09-a94f-52e95936d418'
    `, [codigocurso, identificadorpersona, codigocampus, codigoperiodoletivo])

    console.log('[unlockStudent] Rows affected:', result.rowCount)

    if (result.rowCount && result.rowCount > 0) {
      return {
        success: true,
        message: 'Período de liberação encerrado com sucesso. O aluno ficará bloqueado após hoje às 23:59.',
        affectedRows: result.rowCount
      }
    } else {
      return {
        success: false,
        message: 'Nenhuma regra de liberação encontrada para este aluno',
        affectedRows: 0
      }
    }
  } catch (error) {
    console.error('Erro ao encerrar liberação do aluno:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao encerrar liberação do aluno',
      affectedRows: 0
    }
  }
}