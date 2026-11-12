import type { AlunoHmlE2e, RegraGravacaoE2e, CenarioE2e, StatusCenarioE2e, ResultadoTentativaE2e, SituacaoExecucaoE2e, SituacaoTesteE2e, VerificacaoE2e } from '~~/types'

/**
 * Textos da tela "Cenários E2E" (e2e/PLANO.md 4): status, perfil em linguagem simples.
 */

type CorBadge = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'

export const STATUS_E2E: Record<StatusCenarioE2e, { rotulo: string, cor: CorBadge, ajuda: string }> = {
  'gravado': { rotulo: 'Gravado', cor: 'success', ajuda: 'Tem gravação conferida com a tela esperada e vira teste' },
  'a-confirmar': { rotulo: 'Conferir tela', cor: 'info', ajuda: 'O cenário não tem tela esperada: a esteira gravou o primeiro aluno que abriu numa tela da jornada. Confira a captura e defina a tela esperada (ainda não vira teste)' },
  'a-gravar': { rotulo: 'A gravar', cor: 'neutral', ajuda: 'Perfil definido, ainda não rodou a esteira' },
  'nao-encontrado': { rotulo: 'Sem aluno', cor: 'warning', ajuda: 'Nenhum candidato chegou numa tela da jornada em HML (não abriu ou estava fora do período). Informe um aluno' },
  'divergente': { rotulo: 'Outra tela', cor: 'error', ajuda: 'Os candidatos abriram, mas em outra tela da jornada: revise o perfil ou a tela esperada' }
}

/** O que cada resultado de tentativa quer dizer (title dos badges) */
export const AJUDA_RESULTADO: Record<ResultadoTentativaE2e, string> = {
  'confere': 'Abriu na tela esperada do cenário',
  'sem-esperado': 'Abriu numa tela da jornada; o cenário não tem tela esperada para comparar',
  'outra-tela': 'Abriu, mas numa tela diferente da esperada',
  'outra-regra': 'Abriu, mas o dado do aluno (ObterInformacoesAluno) cai em outra regra de tela: o aluno não serve para o cenário',
  'nao-abriu': 'Não saiu da autorização ou caiu em erro (aluno inexistente no HML, sessão recusada)',
  'fora-do-periodo': '"Estamos fora do período de rematrícula": o soft launch não valeu para a combinação curso/persona/campus/período que o HML usa para este aluno',
  'falhou': 'O gravador falhou',
  'pulado': 'Não foi gravado (ex.: sem persona)'
}

export const RESULTADO_TENTATIVA: Record<ResultadoTentativaE2e, { rotulo: string, cor: CorBadge }> = {
  'confere': { rotulo: 'Confere', cor: 'success' },
  'sem-esperado': { rotulo: 'Abriu (sem esperado)', cor: 'info' },
  'outra-tela': { rotulo: 'Outra tela', cor: 'error' },
  'outra-regra': { rotulo: 'Outra regra', cor: 'warning' },
  'nao-abriu': { rotulo: 'Não abriu', cor: 'warning' },
  'fora-do-periodo': { rotulo: 'Fora do período', cor: 'warning' },
  'falhou': { rotulo: 'Falhou', cor: 'error' },
  'pulado': { rotulo: 'Pulado', cor: 'neutral' }
}

/** Frases para cada valor de indicador. [quando 'S', quando 'N'] */
const INDICADORES: Record<string, [string, string]> = {
  IND_REG_FINANCEIRO: ['sem pendência financeira', 'com pendência financeira'],
  IND_CONTRATO_LIBERADO: ['contrato liberado', 'contrato não liberado'],
  IND_CONTRATO_ASSINADO: ['contrato assinado', 'contrato não assinado'],
  IND_MEDICINA: ['de Medicina', 'fora de Medicina'],
  IND_OFERTA_UCDP: ['com oferta de UC personalizável', 'sem oferta de UC personalizável'],
  IND_CONFIRMADO_UCDP: ['UC personalizável confirmada', 'UC personalizável não confirmada'],
  IND_OFERTA_CORE: ['com oferta de core curriculum', 'sem oferta de core curriculum'],
  IND_CONFIRMADO_CORE: ['core curriculum confirmado', 'core curriculum não confirmado'],
  IND_NAO_CONFI_PEND_ACAD_E2A2: ['com pendência acadêmica E2A não confirmada', 'sem pendência acadêmica E2A em aberto'],
  IND_CONFIRMADO_OFERTA_PRINC: ['grade confirmada', 'grade não confirmada'],
  IND_CALOURO: ['calouro', 'veterano'],
  IND_EXECUTOU_LIBERACAO: ['liberação executada', 'liberação não executada'],
  IND_EXECUTOU_PROMOCAO: ['promoção executada', 'promoção não executada'],
  IND_POSSUI_HORARIO: ['com horário', 'sem horário'],
  IND_NAO_POSSUI_HORARIO: ['sem horário', 'com horário']
}

const COLUNAS: Record<string, string> = {
  QTDE_DP_NA_MAT: 'DPs na matrícula',
  COD_TPO_PERSONA: 'persona',
  DSC_TPO_GRD_CURRICULAR: 'tipo de grade',
  COD_PERIODO_LETIVO: 'período letivo',
  COD_CURSO: 'curso',
  COD_CAMPUS: 'campus'
}

function comparacao(valor: string): string {
  const m = valor.match(/^(>=|<=|<>|>|<|=)\s*(-?\d+)$/)
  if (!m) return valor
  const op: Record<string, string> = { '>': 'mais de', '>=': 'pelo menos', '<': 'menos de', '<=': 'até', '=': '', '<>': 'diferente de' }
  return `${op[m[1]!]} ${m[2]}`.trim()
}

/** Uma frase por chave do perfil. Chaves que não são da view aparecem como descrição. */
export function descreverPerfil(perfil: Record<string, unknown> | undefined): string[] {
  if (!perfil) return []
  return Object.entries(perfil).map(([chave, valor]) => {
    const ind = INDICADORES[chave]
    if (ind && (valor === 'S' || valor === 'N')) return valor === 'S' ? ind[0] : ind[1]

    const nome = COLUNAS[chave]
    if (nome) {
      if (valor === null) return `sem ${nome}`
      if (chave === 'QTDE_DP_NA_MAT' && valor === '>0') return 'com DP na matrícula'
      if (typeof valor === 'string' && valor.startsWith('~')) return `${nome} contém "${valor.slice(1)}"`
      return `${nome}: ${typeof valor === 'string' ? comparacao(valor) : String(valor)}`
    }
    if (chave === 'descricao') return String(valor)
    return `${chave}: ${valor === null ? 'nulo' : String(valor)}`
  })
}

/** Telas que a gravação avançou sem gravar no HML (e2e/scripts/avancos.mjs) */
const AVANCOS_E2E: Record<string, string> = {
  certificado: 'certificado do ensino médio tratado como enviado',
  contrato: 'contrato tratado como aceito'
}

export function textoAvancos(avancos: string[]): string {
  return `A gravação avançou telas que travavam antes desta (sem gravar nada no HML): ${avancos.map(a => AVANCOS_E2E[a] ?? a).join('; ')}.`
}

/** Cenário que só anda com alguém informando o aluno (aba "Não encontrados"). */
export function precisaDeAluno(c: CenarioE2e): boolean {
  if (c.status === 'nao-encontrado' || c.status === 'divergente') return true
  return c.status === 'a-gravar' && c.fonte === 'manual'
}

/** Cenários "fora do prazo" não podem ser liberados no soft launch. */
export function liberarPorPadrao(c: CenarioE2e): boolean {
  return c.perfil?.softLaunch !== 'fora'
}

/** Rota observada → regex que casa com ela (sugestão ao criar/confirmar). */
export function sugerirRegexRota(rota: string | undefined): string {
  if (!rota) return ''
  return rota.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Captura de gravação (gravacoes/…) ou de execução da suíte (resultados/…). */
export function urlCaptura(caminho: string, versao?: string): string {
  const rota = caminho.startsWith('resultados/') ? 'artefato' : 'captura'
  return `/api/e2e/${rota}?caminho=${encodeURIComponent(caminho)}${versao ? `&v=${encodeURIComponent(versao)}` : ''}`
}

export function urlArtefato(caminho: string): string {
  return `/api/e2e/artefato?caminho=${encodeURIComponent(caminho)}`
}

export const SITUACAO_TESTE_E2E: Record<SituacaoTesteE2e, { rotulo: string, cor: CorBadge, icone: string }> = {
  'passou': { rotulo: 'Passou', cor: 'success', icone: 'i-lucide-circle-check' },
  'falhou': { rotulo: 'Falhou', cor: 'error', icone: 'i-lucide-circle-x' },
  'massa-invalida': { rotulo: 'Massa inválida', cor: 'warning', icone: 'i-lucide-user-x' },
  'instavel': { rotulo: 'Instável', cor: 'warning', icone: 'i-lucide-circle-alert' },
  'pulado': { rotulo: 'Pulado', cor: 'neutral', icone: 'i-lucide-circle-minus' }
}

/** O que cada situação quer dizer (title do badge na aba Execução) */
export const AJUDA_SITUACAO_TESTE: Record<SituacaoTesteE2e, string> = {
  'passou': 'O front parou na tela que a regra manda e mostrou o que o catálogo pede',
  'falhou': 'Alguma verificação falhou: veja a lista no detalhe',
  'massa-invalida': 'O aluno gravado não cai na regra do cenário: o teste não diz nada sobre o front. Troque o aluno (descartar) ou revise a regra',
  'instavel': 'Falhou e passou na repetição',
  'pulado': 'Não rodou (ex.: sem gravação nesta máquina)'
}

/** Rótulo curto de cada tipo de verificação (e2e/tests/verificacao.mjs) */
export const TIPO_VERIFICACAO_E2E: Record<VerificacaoE2e['tipo'], string> = {
  'massa': 'Massa',
  'catalogo': 'Catálogo',
  'regra': 'Regra',
  'rota': 'Tela',
  'texto': 'Texto',
  'botao': 'Botão',
  'desabilitado': 'Desabilitado',
  'nao-deve': 'Não deve',
  'api': 'API'
}

/** Mesma tela? Só o caminho, sem diferenciar maiúsculas, sem query e sem barra final (como e2e/regras/regras.mjs) */
export function mesmaRotaE2e(a: string | undefined, b: string | undefined): boolean {
  const norm = (s: string | undefined) => String(s ?? '').split(/[?#]/)[0]!.replace(/\/+$/, '').toLowerCase() || '/'
  return norm(a) === norm(b)
}

/** Valor de campo do ObterInformacoesAluno para leitura ("sim", "não", "nulo", lista) */
export function valorCampo(v: unknown): string {
  if (v === true) return 'sim'
  if (v === false) return 'não'
  if (v === null || v === undefined) return 'nulo'
  if (Array.isArray(v)) return v.length ? `[${v.join(', ')}]` : '[]'
  return String(v)
}

export const SITUACAO_EXECUCAO_E2E: Record<SituacaoExecucaoE2e, { rotulo: string, cor: CorBadge }> = {
  rodando: { rotulo: 'Rodando', cor: 'info' },
  concluida: { rotulo: 'Concluída', cor: 'success' },
  interrompida: { rotulo: 'Interrompida', cor: 'warning' },
  falhou: { rotulo: 'Não rodou', cor: 'error' }
}

/** Alvo da execução pelo id (20261111-143005-hml → hml) */
export function alvoDaExecucao(id: string): string {
  return id.split('-').slice(2).join('-')
}

/** Id a partir do título: "Contrato não aceito" → "contrato-nao-aceito" */
export function idDoTitulo(titulo: string): string {
  return titulo
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export function mensagemDeErro(e: unknown, padrao = 'Erro inesperado'): string {
  const err = e as { data?: { message?: string, statusMessage?: string }, message?: string }
  return err?.data?.message || err?.data?.statusMessage || err?.message || padrao
}

/** novo: do zero; a-partir-de: gravação de um candidato; editar: título/esperado; confirmar: a-confirmar → gravado */
export type ModoFormCenario = 'novo' | 'a-partir-de' | 'editar' | 'confirmar'

/** Gravação de candidato usada para criar um cenário */
export interface OrigemGravacao {
  cenario: string
  codigoAluno: number
  rota?: string
  captura?: string
  /** Regra de tela que o dado do candidato aciona */
  regra?: RegraGravacaoE2e
}

/** "2026/2 · cód. 13168" etc. para o resumo do aluno no HML */
export function descreverAlunoHml(a: AlunoHmlE2e | undefined): string {
  if (!a) return ''
  const partes = [
    a.periodoLetivo ? `período ${a.periodoLetivo}${a.codigoPeriodoLetivo ? ` (${a.codigoPeriodoLetivo})` : ''}` : '',
    a.curso ? `${a.curso}${a.codigoCurso ? ` (${a.codigoCurso})` : ''}` : '',
    a.instituicao ?? '',
    a.persona !== null ? `persona ${a.persona}` : '',
    a.estaNoSoftLaunch === null ? '' : a.estaNoSoftLaunch ? 'no soft launch' : 'fora do soft launch'
  ]
  return partes.filter(Boolean).join(' · ')
}
