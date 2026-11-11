import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  CenarioE2e,
  EstadoEsteiraE2e,
  ResultadoCenarioE2e,
  StatusCenarioE2e,
  TentativaE2e
} from '../../../types'
import type { CandidatoE2e } from '../databricks'
import type { EscopoRegraAnterior } from '../db_soft'
import { findE2eCandidates } from '../../repositories/databricksRepository'
import { lerEscopo, releaseStudent, restaurarEscopo } from '../../repositories/softLaunchRepository'
import { getOrRefreshToken } from '../azure-token'
import { buildAccessUrl } from '../url-builder'
import { atualizarCenario, lerCatalogo, pastaE2e, perfilParaWhere, registrarAlunoLocal } from './catalogo'
import { gravarComLink } from './processo'
import { PASTA_CANDIDATOS } from './arquivos'
import { execucaoRodando } from './execucao'

/**
 * Esteira de geração de cenários (e2e/PLANO.md 3.3), usada pela geração automática (①)
 * e pela inclusão manual de aluno (②). Um cenário por vez, com trava em memória.
 *
 * Para cada candidato: libera a combinação no soft launch (HML), gera o link de impersonate,
 * grava com e2e/scripts/gravar.mjs e classifica pela tela real. No fim da execução,
 * devolve o soft launch ao estado anterior (melhor esforço).
 */

export interface CredenciaisE2e {
  email: string
  /** Opcional: sem ela, o token de HML vem do cache ou do refresh token (getOrRefreshToken) */
  password?: string
}

const MAX_LOG = 300

const estado: EstadoEsteiraE2e = { rodando: false, resultados: [], log: [] }

export function estadoEsteira(): EstadoEsteiraE2e {
  return { ...estado, resultados: [...estado.resultados], log: [...estado.log] }
}

function registrar(mensagem: string): void {
  console.log(`[E2E] ${mensagem}`)
  estado.log.push(`${new Date().toISOString()} ${mensagem}`)
  if (estado.log.length > MAX_LOG) estado.log.splice(0, estado.log.length - MAX_LOG)
}

/**
 * O banco do soft launch é um só (DB_SOFT_HOST) e o código não tem trava de ambiente (PLANO.md 8).
 * A esteira só roda se o host configurado for o de HML declarado em E2E_DB_SOFT_HOST_HML.
 */
function garantirSoftLaunchHml(): void {
  const config = useRuntimeConfig()
  const hml = String(config.e2eDbSoftHostHml || '').trim()
  if (!hml) {
    throw new Error('Defina E2E_DB_SOFT_HOST_HML no .env com o host do banco do soft launch de HML.')
  }
  if (String(config.dbSoftHost || '').trim() !== hml) {
    throw new Error('DB_SOFT_HOST não é o host de HML (E2E_DB_SOFT_HOST_HML). A esteira não roda fora de HML.')
  }
}

function travar(email: string): void {
  if (estado.rodando) {
    throw new Error(`A esteira já está rodando (iniciada por ${estado.iniciadoPor} em ${estado.iniciadoEm}).`)
  }
  if (execucaoRodando()) {
    throw new Error('A suíte está executando (aba Execução). Espere terminar para gravar.')
  }
  garantirSoftLaunchHml()
  estado.rodando = true
  estado.iniciadoPor = email
  estado.iniciadoEm = new Date().toISOString()
  estado.terminadoEm = undefined
  estado.cenarioAtual = undefined
  estado.resultados = []
  estado.log = []
}

function destravar(): void {
  estado.rodando = false
  estado.cenarioAtual = undefined
  estado.terminadoEm = new Date().toISOString()
}

// ---------------------------------------------------------------------------
// Soft launch: libera cada combinação uma vez por execução e restaura no fim
// ---------------------------------------------------------------------------

interface Combinacao {
  curso: number
  persona: number
  campus: number
  periodo: number
}

class Liberacoes {
  private readonly anteriores = new Map<string, { combinacao: Combinacao, anterior: EscopoRegraAnterior }>()

  constructor(private readonly email: string) {}

  private chave(c: Combinacao): string {
    return `${c.curso}-${c.persona}-${c.campus}-${c.periodo}`
  }

  async garantir(c: Combinacao): Promise<void> {
    const chave = this.chave(c)
    if (this.anteriores.has(chave)) return

    const anterior = await lerEscopo(c.curso, c.persona, c.campus, c.periodo)
    // Anota antes de liberar: se o liberar falhar no meio, a restauração ainda sabe o que fazer.
    this.anteriores.set(chave, { combinacao: c, anterior })
    console.log(`[AUDIT] ${this.email} (e2e) liberando - Curso: ${c.curso}, Persona: ${c.persona}, Campus: ${c.campus}, Período: ${c.periodo}`)
    const r = await releaseStudent(c.curso, c.persona, c.campus, c.periodo)
    if (!r.success) {
      throw new Error(`Não foi possível liberar a combinação ${chave}: ${r.message}`)
    }
    registrar(`Liberada a combinação ${chave} (${anterior.existe ? 'linha existente' : 'linha nova'})`)
  }

  /** Melhor esforço: falha só vai para o log (a liberação expira sozinha em 23h59). */
  async restaurarTodas(): Promise<void> {
    for (const [chave, { combinacao: c, anterior }] of this.anteriores) {
      try {
        const linhas = await restaurarEscopo(c.curso, c.persona, c.campus, c.periodo, anterior)
        console.log(`[AUDIT] ${this.email} (e2e) restaurou soft launch ${chave} (${anterior.existe ? 'datafim anterior' : 'linha removida'}, ${linhas} linha(s))`)
        registrar(`Restaurada a combinação ${chave}`)
      } catch (e) {
        registrar(`AVISO: não foi possível restaurar a combinação ${chave}: ${e instanceof Error ? e.message : e}. Expira em até 23h59.`)
      }
    }
    this.anteriores.clear()
  }
}

// ---------------------------------------------------------------------------
// Um cenário
// ---------------------------------------------------------------------------

async function limparCandidatosAntigos(id: string): Promise<void> {
  const pasta = path.join(pastaE2e(), PASTA_CANDIDATOS)
  await fs.mkdir(pasta, { recursive: true })
  for (const arquivo of await fs.readdir(pasta)) {
    if (arquivo.startsWith(`${id}--`)) await fs.rm(path.join(pasta, arquivo), { force: true })
  }
}

/**
 * Move a gravação aprovada para gravacoes/<id>.har (+ .png) e devolve o novo caminho da captura.
 * Ponto único por onde passa toda gravação aprovada: o anonimizador entra aqui (PLANO.md 3.4).
 */
export async function promoverGravacao(id: string, har: string, png?: string): Promise<string | undefined> {
  const base = pastaE2e()
  await fs.rename(path.join(base, har), path.join(base, 'gravacoes', `${id}.har`))
  if (!png) return undefined
  const destino = `gravacoes/${id}.png`
  try {
    await fs.rename(path.join(base, png), path.join(base, destino))
    return destino
  } catch {
    return undefined
  }
}

interface OpcoesCenario {
  credenciais: CredenciaisE2e
  liberacoes: Liberacoes
  /** false: grava sem liberar (cenários fora do prazo / soft launch) */
  liberar: boolean
  alunosNoPerfil?: number
}

async function tentarCandidato(
  cenario: CenarioE2e,
  candidato: CandidatoE2e,
  op: OpcoesCenario
): Promise<{ tentativa: TentativaE2e, har?: string }> {
  const codigoAluno = candidato.COD_ALUNO

  if (op.liberar) {
    if (candidato.COD_TPO_PERSONA === null) {
      return { tentativa: { codigoAluno, resultado: 'pulado', motivo: 'sem persona: o liberar exige persona' } }
    }
    await op.liberacoes.garantir({
      curso: candidato.COD_CURSO,
      persona: candidato.COD_TPO_PERSONA,
      campus: candidato.COD_CAMPUS,
      periodo: candidato.COD_PERIODO_LETIVO
    })
  }

  const token = await getOrRefreshToken(op.credenciais.email, 'hml', op.credenciais.password)
  if (!token.success || !token.access_token || !token.refresh_token) {
    throw new Error(token.requiresPassword
      ? 'Token de HML venceu e não deu para renovar: informe a senha e rode de novo.'
      : `Token de HML: ${token.error || 'não gerado'}`)
  }
  const link = buildAccessUrl('hml', token.access_token, token.refresh_token, String(codigoAluno))
  console.log(`[AUDIT] ${op.credenciais.email} (e2e) gravou aluno ${codigoAluno} em HML para o cenário ${cenario.id}`)

  const saida = `${PASTA_CANDIDATOS}/${cenario.id}--${codigoAluno}`
  const g = await gravarComLink(link, saida, cenario.esperado?.rota)
  if (!g.ok || !g.resultado) {
    return { tentativa: { codigoAluno, resultado: 'falhou', motivo: g.erro } }
  }
  registrar(`${cenario.id}: aluno ${codigoAluno} → ${g.rota || '(raiz)'} [${g.resultado}]`)
  const avancos = g.avancos?.length ? g.avancos : undefined
  if (avancos) registrar(`${cenario.id}: aluno ${codigoAluno} avançou ${avancos.join(', ')}`)
  return { tentativa: { codigoAluno, resultado: g.resultado, rota: g.rota, png: g.png, avancos }, har: g.har }
}

async function processarCenario(
  cenario: CenarioE2e,
  candidatos: CandidatoE2e[],
  op: OpcoesCenario
): Promise<ResultadoCenarioE2e> {
  estado.cenarioAtual = cenario.id
  await limparCandidatosAntigos(cenario.id)

  const tentativas: TentativaE2e[] = []
  let aprovado: { tentativa: TentativaE2e, har: string } | undefined

  for (const candidato of candidatos) {
    const { tentativa, har } = await tentarCandidato(cenario, candidato, op)
    tentativas.push(tentativa)
    if (har && (tentativa.resultado === 'confere' || tentativa.resultado === 'sem-esperado')) {
      aprovado = { tentativa, har }
      break
    }
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const geradoPor = op.credenciais.email.split('@')[0]
  const rotasDiferentes = [...new Set(tentativas.filter(t => t.resultado === 'outra-tela').map(t => t.rota ?? ''))]

  let status: StatusCenarioE2e
  if (aprovado?.tentativa.resultado === 'confere') status = 'gravado'
  else if (aprovado) status = 'a-confirmar'
  else if (rotasDiferentes.length > 0) status = 'divergente'
  else status = 'nao-encontrado'

  // Cenário já gravado não perde a gravação por uma nova tentativa que não confirmou.
  const preservar = (cenario.status === 'gravado' || cenario.status === 'a-confirmar') && !aprovado

  if (aprovado) {
    aprovado.tentativa.png = await promoverGravacao(cenario.id, aprovado.har, aprovado.tentativa.png)
    await registrarAlunoLocal(cenario.id, aprovado.tentativa.codigoAluno)
  }

  await atualizarCenario(cenario.id, (c) => {
    if (op.alunosNoPerfil !== undefined) c.alunosNoPerfil = op.alunosNoPerfil
    if (preservar) return
    c.status = status
    c.geradoPor = geradoPor
    if (aprovado) {
      if (aprovado.tentativa.avancos) c.avancos = aprovado.tentativa.avancos
      else delete c.avancos
    }
    if (status === 'gravado') {
      c.gravadoEm = hoje
      delete c.observado
    } else if (status === 'a-confirmar') {
      c.gravadoEm = hoje
      c.observado = { em: hoje, rota: aprovado!.tentativa.rota }
    } else if (status === 'divergente') {
      c.observado = { em: hoje, rotas: rotasDiferentes }
    } else {
      c.observado = { em: hoje }
    }
  })

  registrar(`${cenario.id}: ${preservar ? `mantido como gravado (nova tentativa: ${status})` : status}`)
  return {
    id: cenario.id,
    status: preservar ? 'gravado' : status,
    catalogoAtualizado: !preservar,
    alunosNoPerfil: op.alunosNoPerfil,
    tentativas
  }
}

// ---------------------------------------------------------------------------
// ① Geração automática
// ---------------------------------------------------------------------------

export interface OpcoesGeracao {
  /** Cenários a gerar. Padrão: todos de fonte databricks que não estão gravados nem a confirmar. */
  ids?: string[]
  /** Restringe os candidatos a um período letivo */
  periodo?: number
  /** Candidatos por cenário (padrão 5) */
  candidatos?: number
}

const STATUS_PENDENTES: StatusCenarioE2e[] = ['a-gravar', 'nao-encontrado', 'divergente']

/**
 * Valida a trava e o ambiente na hora e roda a geração em segundo plano.
 * O progresso fica em estadoEsteira().
 */
export async function iniciarGeracao(credenciais: CredenciaisE2e, opcoes: OpcoesGeracao): Promise<void> {
  const catalogo = await lerCatalogo()
  const alvo = catalogo.cenarios.filter(c =>
    opcoes.ids?.length ? opcoes.ids.includes(c.id) : STATUS_PENDENTES.includes(c.status) && c.fonte === 'databricks'
  )
  travar(credenciais.email)
  registrar(`Geração iniciada por ${credenciais.email}: ${alvo.map(c => c.id).join(', ') || '(nenhum cenário pendente)'}`)

  void (async () => {
    const liberacoes = new Liberacoes(credenciais.email)
    try {
      for (const cenario of alvo) {
        try {
          if (cenario.fonte !== 'databricks') {
            throw new Error('cenário manual: informe o código do aluno (aba Não encontrados)')
          }
          const condicoes = perfilParaWhere(cenario.perfil)
          if (opcoes.periodo) condicoes.push(`COD_PERIODO_LETIVO = ${Math.trunc(opcoes.periodo)}`)
          const { candidatos, total } = await findE2eCandidates(condicoes, opcoes.candidatos ?? 5)
          registrar(`${cenario.id}: ${total} aluno(s) no perfil, ${candidatos.length} candidato(s)`)
          estado.resultados.push(await processarCenario(cenario, candidatos, {
            credenciais, liberacoes, liberar: true, alunosNoPerfil: total
          }))
        } catch (e) {
          const erro = e instanceof Error ? e.message : String(e)
          registrar(`${cenario.id}: ERRO ${erro}`)
          estado.resultados.push({ id: cenario.id, status: cenario.status, catalogoAtualizado: false, tentativas: [], erro })
          // Credencial inválida derruba todos os cenários seguintes: para aqui.
          if (erro.startsWith('Token de HML')) break
        }
      }
    } finally {
      await liberacoes.restaurarTodas()
      registrar('Geração terminada')
      destravar()
    }
  })()
}

// ---------------------------------------------------------------------------
// ② Aluno informado por alguém do time
// ---------------------------------------------------------------------------

export interface OpcoesAlunoInformado {
  id: string
  codigoAluno: number
  /** false: não mexe no soft launch (ex.: cenário "fora do prazo") */
  liberar: boolean
}

/** Roda a esteira para um aluno e devolve o resultado (síncrono: uma gravação leva ~30 s). */
export async function gravarAlunoInformado(credenciais: CredenciaisE2e, opcoes: OpcoesAlunoInformado): Promise<ResultadoCenarioE2e> {
  const catalogo = await lerCatalogo()
  const cenario = catalogo.cenarios.find(c => c.id === opcoes.id)
  if (!cenario) throw new Error(`Cenário não encontrado no catálogo: ${opcoes.id}`)

  travar(credenciais.email)
  registrar(`Gravação do aluno informado por ${credenciais.email} para ${cenario.id} (liberar: ${opcoes.liberar ? 'sim' : 'não'})`)
  const liberacoes = new Liberacoes(credenciais.email)
  try {
    let candidato: CandidatoE2e
    if (opcoes.liberar) {
      // A combinação (curso, persona, campus, período) do liberar vem da view.
      const { candidatos } = await findE2eCandidates([`COD_ALUNO = ${Math.trunc(opcoes.codigoAluno)}`], 1)
      if (!candidatos[0]) {
        throw new Error(`Aluno ${opcoes.codigoAluno} não está na sb_jira.wv_alunos_rem: sem a combinação, não dá para liberar. Tente sem liberar.`)
      }
      candidato = candidatos[0]
    } else {
      candidato = { COD_ALUNO: opcoes.codigoAluno, COD_CURSO: 0, COD_TPO_PERSONA: null, COD_CAMPUS: 0, COD_PERIODO_LETIVO: 0 }
    }
    const resultado = await processarCenario(cenario, [candidato], { credenciais, liberacoes, liberar: opcoes.liberar })
    estado.resultados.push(resultado)
    return resultado
  } finally {
    await liberacoes.restaurarTodas()
    destravar()
  }
}
