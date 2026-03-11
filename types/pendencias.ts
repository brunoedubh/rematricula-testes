export interface ResumoPendencias {
  total_aptos: number
  total_com_pendencias: number
  total_pendencias_ativas: number
  percentual_pendentes: number
}

export interface TipoPendencia {
  id: number
  slug: string
  nom_pendencia: string
  dsc_pendencia: string | null
  tabela: string
  ind_prerematricula: boolean
  total_afetados: number
}

export interface AlunoComPendencias {
  cod_aluno: number
  cod_pessoa: number
  nom_aluno: string
  num_matricula: string
  total_pendencias: number
}
