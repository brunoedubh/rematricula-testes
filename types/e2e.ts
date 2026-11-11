/**
 * Catálogo de cenários do e2e (e2e/cenarios/catalogo.json) e esteira de geração (e2e/PLANO.md, seção 3)
 */

export type StatusCenarioE2e = 'gravado' | 'a-gravar' | 'a-confirmar' | 'nao-encontrado' | 'divergente'

export type FonteCenarioE2e = 'databricks' | 'manual'

export interface CenarioE2e {
  id: string
  titulo: string
  status: StatusCenarioE2e
  perfil: Record<string, unknown>
  esperado?: {
    rota?: string
    textos?: string[]
    botoes?: string[]
  }
  fonte?: FonteCenarioE2e
  gravadoEm?: string
  /** Login (sem domínio) de quem rodou a esteira por último neste cenário */
  geradoPor?: string
  /**
   * Telas que travavam antes da tela do cenário e foram avançadas na gravação
   * (ex.: "certificado", "contrato"), ajustando a resposta de ObterInformacoesAluno. Ver e2e/scripts/avancos.mjs.
   */
  avancos?: string[]
  /** Quantos alunos da view satisfazem o perfil (prioridade na tela de cobertura) */
  alunosNoPerfil?: number
  /** O que a esteira viu na última tentativa sem sucesso ou sem esperado */
  observado?: {
    em: string
    rota?: string
    rotas?: string[]
  }
}

export interface CatalogoE2e {
  versao: number
  descricao?: string
  status_possiveis?: Record<string, string>
  perfil?: string
  cenarios: CenarioE2e[]
}

export type ResultadoTentativaE2e = 'confere' | 'nao-abriu' | 'outra-tela' | 'sem-esperado' | 'falhou' | 'pulado'

export interface TentativaE2e {
  codigoAluno: number
  resultado: ResultadoTentativaE2e
  rota?: string
  motivo?: string
  /** Telas avançadas nesta gravação (certificado, contrato) */
  avancos?: string[]
  /** Captura da tela final, relativa a e2e/ */
  png?: string
}

export interface ResultadoCenarioE2e {
  id: string
  status: StatusCenarioE2e
  /** false quando o catálogo não foi alterado (ex.: cenário já gravado e a nova tentativa não confirmou) */
  catalogoAtualizado: boolean
  alunosNoPerfil?: number
  tentativas: TentativaE2e[]
  erro?: string
}

export interface EstadoEsteiraE2e {
  rodando: boolean
  iniciadoPor?: string
  iniciadoEm?: string
  terminadoEm?: string
  cenarioAtual?: string
  resultados: ResultadoCenarioE2e[]
  log: string[]
}

/** Gravação e capturas de um cenário em e2e/gravacoes (caminhos relativos a e2e/) */
export interface ArquivosCenarioE2e {
  /** Existe gravacoes/<id>.har (o teste roda) */
  gravacao: boolean
  /** gravacoes/<id>.png */
  captura?: string
  /** Gravações de candidatos que não foram aprovados (gravacoes/candidatos/<id>--<aluno>.*) */
  candidatos: { codigoAluno: number, gravacao: boolean, captura?: string }[]
}

export interface RespostaCenariosE2e {
  cenarios: CenarioE2e[]
  arquivos: Record<string, ArquivosCenarioE2e>
  esteira: EstadoEsteiraE2e
}

// ---------------------------------------------------------------------------
// Execução da suíte (e2e/PLANO.md 5): resumo gravado por e2e/scripts/resumo.mjs
// ---------------------------------------------------------------------------

export type SituacaoTesteE2e = 'passou' | 'falhou' | 'instavel' | 'pulado'

export type SituacaoExecucaoE2e = 'rodando' | 'concluida' | 'interrompida' | 'falhou'

export interface TesteExecucaoE2e {
  cenario: string
  titulo: string
  dispositivo: string
  situacao: SituacaoTesteE2e
  duracaoMs: number
  rotaEsperada?: string
  /** Tela onde o app parou, relativa ao alvo */
  rotaObtida?: string
  /** Chamadas que o front fez e a gravação não tem */
  semGravacao: string[]
  motivo?: string
  erro?: string
  /** Caminhos relativos a e2e/ */
  captura?: string
  trace?: string
}

export interface ExecucaoE2e {
  id: string
  alvo: string
  origem: 'tela' | 'linha-de-comando'
  iniciadoPor?: string
  inicio: string
  fim?: string
  situacao: SituacaoExecucaoE2e
  dispositivos: string[]
  /** Só estes cenários (ausente = todos os gravados) */
  cenarios?: string[]
  total: number
  totais: Record<SituacaoTesteE2e, number>
  testes: TesteExecucaoE2e[]
  erros: string[]
}

/** Item do histórico (sem a lista de testes) */
export type ResumoExecucaoE2e = Omit<ExecucaoE2e, 'testes'>

export interface AlvoE2e {
  nome: 'hml' | 'dev' | 'local'
  rotulo: string
  url: string
}

export interface EstadoExecucaoE2e {
  rodando: boolean
  id?: string
  iniciadoPor?: string
  iniciadoEm?: string
  /** Últimas linhas da saída do Playwright */
  log: string[]
}

export interface RespostaExecucoesE2e {
  alvos: AlvoE2e[]
  dispositivos: string[]
  estado: EstadoExecucaoE2e
  execucoes: ResumoExecucaoE2e[]
}
