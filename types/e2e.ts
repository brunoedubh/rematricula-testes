/**
 * Catálogo de cenários do e2e (e2e/cenarios/catalogo.json) e esteira de geração (e2e/PLANO.md, seção 3)
 */

export type StatusCenarioE2e = 'gravado' | 'a-gravar' | 'a-confirmar' | 'nao-encontrado' | 'divergente'

export type FonteCenarioE2e = 'databricks' | 'manual'

/**
 * Colunas da sb_jira.wv_alunos_rem aceitas no WHERE dos cenários (conferidas com DESCRIBE em 11/11/2026).
 * O servidor só aceita estas colunas; a tela usa a descrição para explicar cada uma.
 * Os IND_* são texto 'S'/'N'. A view NÃO tem IND_CONFIRMADO_UCDP, IND_CONFIRMADO_CORE nem IND_*_PEND_ACAD_E2A2.
 */
export const COLUNAS_VIEW_E2E: { coluna: string, descricao: string, exemplo: string }[] = [
  { coluna: 'COD_ALUNO', descricao: 'Código do aluno', exemplo: 'COD_ALUNO = 1234567' },
  { coluna: 'COD_CURSO', descricao: 'Código do curso', exemplo: 'COD_CURSO IN (10962, 10961)' },
  { coluna: 'COD_CAMPUS', descricao: 'Código do campus', exemplo: 'COD_CAMPUS = 141' },
  { coluna: 'COD_MARCA', descricao: 'Código da marca (instituição)', exemplo: 'COD_MARCA = 8' },
  { coluna: 'COD_PERIODO_LETIVO', descricao: 'Período letivo (a view tem ~70; o maior é o atual de produção)', exemplo: 'COD_PERIODO_LETIVO = 13064' },
  { coluna: 'COD_TPO_PERSONA', descricao: 'Persona (nulo = sem persona; o liberar exige persona)', exemplo: 'COD_TPO_PERSONA IS NOT NULL' },
  { coluna: 'COD_CATEGORIA_GRADE', descricao: 'Código da categoria da grade', exemplo: 'COD_CATEGORIA_GRADE = 1' },
  { coluna: 'DSC_TPO_GRD_CURRICULAR', descricao: 'Tipo de grade: Modular, Seriado ou Por Disciplina', exemplo: 'DSC_TPO_GRD_CURRICULAR = \'Seriado\'' },
  { coluna: 'DSC_CATEGORIA_GRADE', descricao: 'Categoria da grade (texto)', exemplo: 'DSC_CATEGORIA_GRADE LIKE \'%EAD%\'' },
  { coluna: 'DSC_STA_MATRICULA', descricao: 'Situação da matrícula (texto)', exemplo: 'DSC_STA_MATRICULA = \'Matriculado\'' },
  { coluna: 'IND_REG_FINANCEIRO', descricao: '\'S\' = sem débito. Sozinho não leva à tela de pendência financeira: quem bloqueia é o contrato não liberado (IND_CONTRATO_LIBERADO)', exemplo: 'IND_REG_FINANCEIRO = \'N\'' },
  { coluna: 'IND_CONTRATO_LIBERADO', descricao: '\'S\' = financeiro liberou o contrato; \'N\' = tela de pendência financeira (o aluno não avança)', exemplo: 'IND_CONTRATO_LIBERADO = \'N\'' },
  { coluna: 'IND_CONTRATO_ASSINADO', descricao: '\'S\' = contrato já aceito/assinado', exemplo: 'IND_CONTRATO_ASSINADO = \'N\'' },
  { coluna: 'IND_MEDICINA', descricao: '\'S\' = curso de Medicina', exemplo: 'IND_MEDICINA = \'S\'' },
  { coluna: 'IND_CONFIRMADO_OFERTA_PRINC', descricao: '\'S\' = grade principal confirmada', exemplo: 'IND_CONFIRMADO_OFERTA_PRINC = \'N\'' },
  { coluna: 'IND_OFERTA_UCDP', descricao: '\'S\' = tem oferta de UC personalizável', exemplo: 'IND_OFERTA_UCDP = \'S\'' },
  { coluna: 'IND_OFERTA_CORE', descricao: '\'S\' = tem oferta de core curriculum', exemplo: 'IND_OFERTA_CORE = \'S\'' },
  { coluna: 'IND_CALOURO', descricao: '\'S\' = calouro', exemplo: 'IND_CALOURO = \'S\'' },
  { coluna: 'IND_EXECUTOU_LIBERACAO', descricao: '\'S\' = liberação executada', exemplo: 'IND_EXECUTOU_LIBERACAO = \'S\'' },
  { coluna: 'IND_EXECUTOU_PROMOCAO', descricao: '\'S\' = promoção executada', exemplo: 'IND_EXECUTOU_PROMOCAO = \'S\'' },
  { coluna: 'IND_POSSUI_HORARIO', descricao: '\'S\' = tem horário', exemplo: 'IND_POSSUI_HORARIO = \'S\'' },
  { coluna: 'IND_NAO_POSSUI_HORARIO', descricao: '\'S\' = não tem horário', exemplo: 'IND_NAO_POSSUI_HORARIO = \'S\'' },
  { coluna: 'QTDE_DP_NA_MAT', descricao: 'Quantidade de DPs na matrícula (número)', exemplo: 'QTDE_DP_NA_MAT > 0' }
]

export interface CenarioE2e {
  id: string
  titulo: string
  status: StatusCenarioE2e
  /**
   * Descrição do aluno do cenário. Chaves que são colunas da view viram o WHERE (formato antigo, ainda aceito);
   * as outras (softLaunch, api, descricao…) são texto para humanos.
   */
  perfil: Record<string, unknown>
  /**
   * WHERE da busca de candidatos, escrito à mão (sem a palavra WHERE). Quando existe, substitui as colunas
   * do perfil e o cenário é de fonte databricks. Validado em server/utils/e2e/where.ts.
   */
  where?: string
  /**
   * Regra de tela que o cenário exercita (id de e2e/regras/regras.mjs); lista quando aceita mais de uma.
   * O teste confere que o aluno gravado cai nela (massa) e que o front para na tela que ela manda.
   */
  regra?: string | string[]
  esperado?: EsperadoE2e
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
    /** Por que nenhum candidato serviu (ex.: todos fora do período em HML) */
    motivo?: string
  }
}

/** O que a tela precisa mostrar (e não mostrar). rota = regex no caminho relativo ao app. */
export interface EsperadoE2e {
  rota?: string
  textos?: string[]
  botoes?: string[]
  /** Botões que precisam aparecer desabilitados (ex.: "Aceitar contrato" antes de concordar) */
  desabilitados?: string[]
  /** Não podem aparecer nesta tela */
  naoDeve?: { textos?: string[], botoes?: string[] }
}

export interface CatalogoE2e {
  versao: number
  descricao?: string
  status_possiveis?: Record<string, string>
  perfil?: string
  cenarios: CenarioE2e[]
}

export type ResultadoTentativaE2e = 'confere' | 'nao-abriu' | 'fora-do-periodo' | 'outra-tela' | 'outra-regra' | 'sem-esperado' | 'falhou' | 'pulado'

// ---------------------------------------------------------------------------
// Regras de tela (oráculo: e2e/regras/regras.mjs, espelho do GerenciadorRotasPrioritarias do front)
// ---------------------------------------------------------------------------

/** Uma regra de tela, na ordem de prioridade em que o front avalia */
export interface RegraE2e {
  ordem: number
  id: string
  titulo: string
  /** Tela final (já depois dos redirects do router) */
  rota: string
  /** A condição em português, com os nomes dos campos do ObterInformacoesAluno */
  condicao: string
  /** Onde a regra está no front */
  fonte: string
  campos: string[]
}

export interface RegraResumoE2e {
  id: string
  titulo: string
  rota: string
}

/** O que o oráculo decidiu para um dado de aluno */
export interface OraculoE2e {
  /** Regra(s) que o cenário declara (só no resultado de teste) */
  declarada?: string[]
  regra: RegraResumoE2e
  rota: string
  /** Todas as regras que valiam, na ordem; a primeira decide */
  aplicaveis: RegraResumoE2e[]
  /** Valores lidos do ObterInformacoesAluno pelas regras aplicáveis */
  campos: Record<string, unknown>
  avisos: string[]
  avancos?: string[]
}

/** Regra do aluno gravado (anotada pelo gravador ou calculada pelo servidor a partir do HAR) */
export interface RegraGravacaoE2e {
  id: string
  titulo: string
  rota: string
  aplicaveis: string[]
}

/** Combinação de regras (e2e/cenarios/combinacoes.json): gravação base + dado ajustado */
export interface CombinacaoE2e {
  id: string
  titulo: string
  /** Cenário cuja gravação é reaproveitada */
  base: string
  /** Campos sobrescritos no ObterInformacoesAluno */
  ajuste: Record<string, unknown>
  /** Regras que valem juntas */
  combina: string[]
  /** A que deve vencer */
  regra: string
  esperado?: EsperadoE2e
}

export interface RespostaRegrasE2e {
  regras: RegraE2e[]
  combinacoes: CombinacaoE2e[]
  /** Combinações com a gravação base nesta máquina (viram teste) */
  combinacoesExecutaveis: string[]
  /** Última execução concluída (para a cobertura por regra) */
  ultimaExecucao?: ExecucaoE2e
}

/** O aluno como o HML o vê (ObterInformacoesAluno), sem dados pessoais (e2e/scripts/aluno.mjs) */
export interface AlunoHmlE2e {
  codigoAluno: number | null
  periodoLetivo: string | null
  codigoPeriodoLetivo: number | null
  curso: string | null
  codigoCurso: number | null
  instituicao: string | null
  campus: string | null
  persona: number | null
  estaNoSoftLaunch: boolean | null
  pendenciaFinanceira: boolean | null
  contratoLiberado: boolean | null
  contratoAceito: boolean | null
  bloqueios: number[]
}

export interface TentativaE2e {
  codigoAluno: number
  resultado: ResultadoTentativaE2e
  rota?: string
  motivo?: string
  /** Telas avançadas nesta gravação (certificado, contrato) */
  avancos?: string[]
  /** Captura da tela final, relativa a e2e/ */
  png?: string
  /** O aluno como o HML o vê */
  aluno?: AlunoHmlE2e
  /** Regra de tela que o dado do aluno aciona */
  regra?: RegraGravacaoE2e
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
  /** Aluno da gravação aprovada (cenarios/alunos.local.json) */
  codigoAluno?: number
  /** Regra de tela que o dado da gravação aprovada aciona */
  regra?: RegraGravacaoE2e
  /** Gravações de candidatos que não foram aprovados (gravacoes/candidatos/<id>--<aluno>.*) */
  candidatos: CandidatoGravadoE2e[]
}

/** Gravação de um candidato (gravacoes/candidatos/<id>--<aluno>.har), com o que o gravador anotou no HAR */
export interface CandidatoGravadoE2e {
  codigoAluno: number
  gravacao: boolean
  captura?: string
  rota?: string
  resultado?: ResultadoTentativaE2e
  aluno?: AlunoHmlE2e
  regra?: RegraGravacaoE2e
}

// ---------------------------------------------------------------------------
// Massa de teste: qual aluno foi usado em cada cenário (GET /api/e2e/massa)
// ---------------------------------------------------------------------------

export interface AlunoMassaE2e {
  codigoAluno: number
  /** aprovado = gravação do cenário; candidato = tentado e não aprovado; descartado = alguém tirou; avulso = gravacoes/extra-* */
  papel: 'aprovado' | 'candidato' | 'descartado' | 'avulso'
  /** Só descartado */
  descarte?: DescarteE2e
  rota?: string
  resultado?: ResultadoTentativaE2e
  captura?: string
  gravadoEm?: string
  aluno?: AlunoHmlE2e
  regra?: RegraGravacaoE2e
}

export interface CenarioMassaE2e {
  id: string
  titulo: string
  status: StatusCenarioE2e
  fonte?: FonteCenarioE2e
  rotaEsperada?: string
  regra?: string | string[]
  alunos: AlunoMassaE2e[]
}

export interface RespostaMassaE2e {
  cenarios: CenarioMassaE2e[]
  /** Gravações fora do catálogo (gravacoes/*.har que não são de nenhum cenário) */
  avulsos: (AlunoMassaE2e & { arquivo: string })[]
}

export interface RespostaCenariosE2e {
  cenarios: CenarioE2e[]
  arquivos: Record<string, ArquivosCenarioE2e>
  esteira: EstadoEsteiraE2e
  /** SQL que a esteira roda para cada cenário (perfil + descartados) */
  filtros: Record<string, FiltroCenarioE2e>
  /** Alunos descartados por cenário (cenarios/descartados.local.json) */
  descartados: Record<string, DescarteE2e[]>
}

/** Aluno que alguém descartou para um cenário: a esteira não sorteia mais esse código */
export interface DescarteE2e {
  codigoAluno: number
  em: string
  /** Login sem domínio */
  por: string
  motivo?: string
  /** O que ele era quando foi descartado */
  papel: 'aprovado' | 'candidato'
}

export interface FiltroCenarioE2e {
  /** Cenário manual: a esteira não busca no Databricks */
  manual: boolean
  /** WHERE atual do cenário (o escrito à mão ou o montado a partir das colunas do perfil), para editar */
  where?: string
  sql?: string
  /** Perfil inválido (coluna desconhecida, valor não suportado) */
  erro?: string
}

/** POST /api/e2e/filtro: prévia do SQL de um WHERE e, opcionalmente, a contagem no Databricks */
export interface PreviaFiltroE2e {
  sql?: string
  fonte: FonteCenarioE2e
  erro?: string
  total?: number
  /** Alguns códigos sorteados (para conferir na busca de alunos) */
  amostra?: number[]
}

// ---------------------------------------------------------------------------
// Execução da suíte (e2e/PLANO.md 5): resumo gravado por e2e/scripts/resumo.mjs
// ---------------------------------------------------------------------------

/** massa-invalida: o aluno gravado não cai na regra do cenário (problema da massa, não do front) */
export type SituacaoTesteE2e = 'passou' | 'falhou' | 'massa-invalida' | 'instavel' | 'pulado'

/**
 * Uma conferência feita pelo teste (e2e/tests/verificacao.mjs).
 * massa: o dado cai na regra do cenário; catalogo: o esperado concorda com a regra; regra: o front parou
 * na tela da regra; rota/texto/botao/desabilitado/nao-deve: o que o catálogo pede; api: ressalva.
 */
export interface VerificacaoE2e {
  tipo: 'massa' | 'catalogo' | 'regra' | 'rota' | 'texto' | 'botao' | 'desabilitado' | 'nao-deve' | 'api'
  descricao: string
  ok: boolean
  /** Não reprova o teste, só alerta */
  ressalva?: boolean
  esperado?: string
  obtido?: string
  erro?: string
}

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
  /** Tela que a regra manda (oráculo) */
  rotaRegra?: string
  /** Decisão do oráculo para o dado usado no teste */
  regra?: OraculoE2e
  /** O que o teste conferiu, uma linha por conferência (testes antigos: vazio) */
  verificacoes?: VerificacaoE2e[]
  tipo?: 'cenario' | 'combinacao' | 'fluxo'
  /** Combinação: gravação base e campos ajustados */
  base?: string
  ajuste?: Record<string, unknown>
  /** Chamadas que o front fez e a gravação não tem */
  semGravacao: string[]
  motivo?: string
  erro?: string
  /** Caminhos relativos a e2e/ */
  captura?: string
  /** Animação do teste realizado (só Chromium) */
  gif?: string
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
