import type { ResumoPendencias, TipoPendencia, AlunoComPendencias } from '../../types'
import { executeQuery, getDatabricksConfig } from '../utils/databricks'

/**
 * Repository para dados de pendências de rematrícula
 * Consulta as tabelas hive_metastore.sb_jira.* no Databricks
 */

/**
 * Retorna métricas gerais: total de aptos, com pendências e pendências ativas
 */
export async function getResumoPendencias(): Promise<ResumoPendencias> {
  const config = useRuntimeConfig()
  const databricksConfig = getDatabricksConfig(config)
  const token = databricksConfig.token

  const query = `
    SELECT
      COUNT(DISTINCT aa.cod_pessoa) AS total_aptos,
      COUNT(DISTINCT CASE WHEN ap.cod_pessoa IS NOT NULL THEN aa.cod_pessoa END) AS total_com_pendencias,
      COUNT(ap.id_pendencia) AS total_pendencias_ativas
    FROM sb_jira.alunos_aptos aa
    LEFT JOIN sb_jira.aluno_pendencias ap
      ON aa.cod_pessoa = ap.cod_pessoa AND ap.ind_ativo = true
  `.trim()

  const data = await executeQuery(databricksConfig, token, query)

  if (!data?.result?.data_array?.[0]) {
    return { total_aptos: 0, total_com_pendencias: 0, total_pendencias_ativas: 0, percentual_pendentes: 0 }
  }

  const row = data.result.data_array[0]
  const total_aptos = parseInt(row[0]) || 0
  const total_com_pendencias = parseInt(row[1]) || 0
  const total_pendencias_ativas = parseInt(row[2]) || 0
  const percentual_pendentes = total_aptos > 0
    ? Math.round((total_com_pendencias / total_aptos) * 1000) / 10
    : 0

  return { total_aptos, total_com_pendencias, total_pendencias_ativas, percentual_pendentes }
}

/**
 * Retorna todos os tipos de pendência com a contagem de alunos afetados
 * Ordena pelo maior número de afetados primeiro
 */
export async function getPendenciasPorTipo(): Promise<TipoPendencia[]> {
  const config = useRuntimeConfig()
  const databricksConfig = getDatabricksConfig(config)
  const token = databricksConfig.token

  const query = `
    SELECT
      tp.id,
      tp.slug,
      tp.nom_pendencia,
      tp.dsc_pendencia,
      tp.tabela,
      CAST(tp.ind_prerematricula AS STRING) AS ind_prerematricula,
      COUNT(DISTINCT ap.cod_pessoa) AS total_afetados
    FROM sb_jira.tipo_pendencia tp
    LEFT JOIN sb_jira.aluno_pendencias ap
      ON tp.id = ap.id_tpo_pendencia AND ap.ind_ativo = true
    WHERE tp.ind_ativo = true
    GROUP BY tp.id, tp.slug, tp.nom_pendencia, tp.dsc_pendencia, tp.tabela, tp.ind_prerematricula
    ORDER BY total_afetados DESC, tp.id ASC
  `.trim()

  const data = await executeQuery(databricksConfig, token, query)

  if (!data?.result?.data_array) return []

  return data.result.data_array.map((row: any[]) => ({
    id: parseInt(row[0]),
    slug: row[1],
    nom_pendencia: row[2],
    dsc_pendencia: row[3] || null,
    tabela: row[4],
    ind_prerematricula: row[5] === 'true' || row[5] === true,
    total_afetados: parseInt(row[6]) || 0
  }))
}

/**
 * Retorna alunos que possuem ao menos uma pendência ativa
 * Ordena pelo maior número de pendências primeiro
 */
export async function getAlunosComPendencias(limit = 200): Promise<AlunoComPendencias[]> {
  const config = useRuntimeConfig()
  const databricksConfig = getDatabricksConfig(config)
  const token = databricksConfig.token

  const query = `
    SELECT
      aa.cod_aluno,
      aa.cod_pessoa,
      aa.nom_aluno,
      aa.num_matricula,
      COUNT(DISTINCT ap.id_pendencia) AS total_pendencias
    FROM sb_jira.alunos_aptos aa
    INNER JOIN sb_jira.aluno_pendencias ap
      ON aa.cod_pessoa = ap.cod_pessoa AND ap.ind_ativo = true
    GROUP BY aa.cod_aluno, aa.cod_pessoa, aa.nom_aluno, aa.num_matricula
    ORDER BY total_pendencias DESC
    LIMIT ${limit}
  `.trim()

  const data = await executeQuery(databricksConfig, token, query)

  if (!data?.result?.data_array) return []

  return data.result.data_array.map((row: any[]) => ({
    cod_aluno: parseInt(row[0]),
    cod_pessoa: parseInt(row[1]),
    nom_aluno: row[2],
    num_matricula: row[3],
    total_pendencias: parseInt(row[4]) || 0
  }))
}
