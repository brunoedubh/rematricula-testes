import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AlvoE2e, EstadoExecucaoE2e, ExecucaoE2e, ResumoExecucaoE2e } from '../../../types'
import { pastaE2e } from './catalogo'
import { estadoEsteira } from './esteira'

/**
 * Aba Execução (e2e/PLANO.md 5): roda `playwright test` em e2e/ como processo filho.
 * Não usa credencial: a suíte só lê as gravações. O resultado de cada execução fica em
 * e2e/resultados/<id>.json (escrito pelo reporter e2e/scripts/resumo.mjs, também fora da tela)
 * e as capturas/traces em e2e/resultados/<id>/artefatos.
 */

export const DISPOSITIVOS_E2E = ['desktop', 'mobile'] as const
export type DispositivoE2e = typeof DISPOSITIVOS_E2E[number]

export const ID_EXECUCAO = /^\d{8}-\d{6}-[a-z0-9-]{1,40}$/

const MAX_LOG = 200
const MAX_HISTORICO = 30
/** A suíte inteira leva ~30 s; o limite só evita processo esquecido. */
const TEMPO_MAXIMO_MS = 20 * 60 * 1000

const estado: EstadoExecucaoE2e = { rodando: false, log: [] }
let filho: ChildProcess | null = null

export function estadoExecucao(): EstadoExecucaoE2e {
  return { ...estado, log: [...estado.log] }
}

export function execucaoRodando(): boolean {
  return estado.rodando
}

/** Códigos de cor ANSI (ESC[...m) da saída do Playwright. */
const CORES_ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

function registrar(linha: string): void {
  const limpa = linha.replace(CORES_ANSI, '').trimEnd()
  if (!limpa) return
  estado.log.push(limpa)
  if (estado.log.length > MAX_LOG) estado.log.splice(0, estado.log.length - MAX_LOG)
}

/** Alvos da suíte. O Vue 3 local fica em E2E_ALVO_LOCAL (padrão: vite em localhost:5173). */
export function alvosE2e(): AlvoE2e[] {
  const config = useRuntimeConfig()
  const barra = (u: string) => u.endsWith('/') ? u : `${u}/`
  return [
    { nome: 'hml', rotulo: 'HML (Vue 2 publicado)', url: barra(String(config.urlBaseHml)) },
    { nome: 'local', rotulo: 'Local (Vue 3)', url: barra(String(config.e2eAlvoLocal || 'http://localhost:5173/rematricula/')) },
    { nome: 'dev', rotulo: 'DEV', url: barra(String(config.urlBaseDev)) }
  ]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Mesmo formato de e2e/scripts/execucao.mjs: 20261111-143005-hml */
function novoId(nomeAlvo: string): string {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${nomeAlvo}`
}

const pastaResultados = () => path.join(pastaE2e(), 'resultados')
const arquivoExecucao = (id: string) => path.join(pastaResultados(), `${id}.json`)

/** O Playwright não precisa dos segredos do Nuxt (Databricks, soft launch, Azure). */
const SEGREDO = /TOKEN|SECRET|PASSWORD|SENHA|KEY|DATABRICKS|DB_SOFT|AZURE|SESSION|ENCRYPTION|HML_LINK|E2E_LINK/i

function ambienteSemSegredos(): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !SEGREDO.test(k)))
}

export interface OpcoesExecucao {
  alvo: AlvoE2e['nome']
  dispositivos: DispositivoE2e[]
  /** Só estes cenários; vazio/ausente = todos os gravados */
  cenarios?: string[]
  iniciadoPor: string
}

/** Inicia a suíte em segundo plano e devolve o id da execução. */
export async function iniciarExecucao(opcoes: OpcoesExecucao): Promise<string> {
  if (estado.rodando) {
    throw new Error(`Já há uma execução em andamento (iniciada por ${estado.iniciadoPor} às ${new Date(estado.iniciadoEm!).toLocaleTimeString('pt-BR')}).`)
  }
  // A esteira move arquivos em gravacoes/ enquanto grava: não rodar os dois juntos.
  if (estadoEsteira().rodando) {
    throw new Error('A esteira de gravação está rodando. Espere terminar para executar a suíte.')
  }

  const alvo = alvosE2e().find(a => a.nome === opcoes.alvo)
  if (!alvo) throw new Error(`Alvo desconhecido: ${opcoes.alvo}`)

  const cli = path.join(pastaE2e(), 'node_modules', '@playwright', 'test', 'cli.js')
  try {
    await fs.access(cli)
  } catch {
    throw new Error('Playwright não instalado em e2e/. Rode: cd e2e && npm ci && npx playwright install chromium')
  }

  const id = novoId(alvo.nome)
  const args = [cli, 'test', ...opcoes.dispositivos.map(d => `--project=${d}`)]
  const env: NodeJS.ProcessEnv = {
    ...ambienteSemSegredos(),
    ALVO: alvo.url,
    E2E_ALVO_NOME: alvo.nome,
    E2E_EXECUCAO: id,
    E2E_ORIGEM: 'tela',
    E2E_INICIADO_POR: opcoes.iniciadoPor,
    FORCE_COLOR: '0'
  }
  if (opcoes.cenarios?.length) env.E2E_CENARIOS = opcoes.cenarios.join(',')
  else delete env.E2E_CENARIOS

  Object.assign(estado, { rodando: true, id, iniciadoPor: opcoes.iniciadoPor, iniciadoEm: new Date().toISOString(), log: [] })
  registrar(`${opcoes.iniciadoPor}: ${alvo.rotulo} (${alvo.url}) · ${opcoes.dispositivos.join(', ')} · ${opcoes.cenarios?.length ? opcoes.cenarios.join(', ') : 'todos os cenários gravados'}`)
  console.log(`[E2E] Execução ${id} iniciada por ${opcoes.iniciadoPor}`)

  const processo = spawn(process.execPath, args, { cwd: pastaE2e(), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  filho = processo

  let resto = ''
  const ler = (d: Buffer) => {
    const linhas = (resto + d.toString()).split(/\r?\n/)
    resto = linhas.pop() ?? ''
    linhas.forEach(registrar)
  }
  processo.stdout?.on('data', ler)
  processo.stderr?.on('data', ler)

  const limite = setTimeout(() => {
    registrar('Tempo máximo atingido: execução cancelada.')
    encerrar(processo)
  }, TEMPO_MAXIMO_MS)

  const terminar = async (codigo: number | null, erro?: string) => {
    clearTimeout(limite)
    registrar(resto)
    resto = ''
    if (erro) registrar(erro)
    registrar(`Playwright terminou (código ${codigo ?? '-'}).`)
    try {
      await fecharResumo(id, alvo.url, opcoes)
    } catch (e) {
      console.error('[E2E] Não foi possível fechar o resumo da execução', e)
    }
    filho = null
    estado.rodando = false
  }
  processo.on('error', e => void terminar(null, `Não foi possível iniciar o Playwright: ${e.message}`))
  processo.on('close', codigo => void terminar(codigo))

  return id
}

function encerrar(processo: ChildProcess): void {
  if (processo.exitCode !== null || !processo.pid) return
  if (process.platform === 'win32') {
    // kill() no Windows encerra só o node principal; /T leva junto workers e navegadores.
    spawn('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { windowsHide: true })
  } else {
    processo.kill('SIGTERM')
  }
}

export function cancelarExecucao(quem: string): boolean {
  if (!estado.rodando || !filho) return false
  registrar(`Cancelada por ${quem}.`)
  encerrar(filho)
  return true
}

/**
 * Garante um resumo coerente quando o Playwright morre antes do onEnd (cancelado, erro de configuração):
 * sem arquivo → cria um com o log; ainda "rodando" → marca como interrompida.
 */
async function fecharResumo(id: string, alvo: string, opcoes: OpcoesExecucao): Promise<void> {
  const atual = await lerExecucao(id)
  if (atual && atual.situacao !== 'rodando') return
  const agora = new Date().toISOString()
  const resumo: ExecucaoE2e = atual
    ? { ...atual, situacao: 'interrompida', fim: agora }
    : {
        id, alvo, origem: 'tela', iniciadoPor: opcoes.iniciadoPor,
        inicio: estado.iniciadoEm ?? agora, fim: agora, situacao: 'falhou',
        dispositivos: opcoes.dispositivos, cenarios: opcoes.cenarios?.length ? opcoes.cenarios : undefined,
        total: 0, totais: { passou: 0, falhou: 0, instavel: 0, pulado: 0 }, testes: [],
        erros: [estado.log.slice(-15).join('\n')]
      }
  await fs.mkdir(pastaResultados(), { recursive: true })
  await fs.writeFile(arquivoExecucao(id), JSON.stringify(resumo, null, 2))
}

export async function lerExecucao(id: string): Promise<ExecucaoE2e | null> {
  if (!ID_EXECUCAO.test(id)) return null
  try {
    return JSON.parse(await fs.readFile(arquivoExecucao(id), 'utf8')) as ExecucaoE2e
  } catch {
    // Ausente, ou sendo reescrito pelo reporter neste instante: a tela lê de novo na próxima consulta.
    return null
  }
}

/** Histórico, da mais recente para a mais antiga (inclui execuções feitas fora da tela). */
export async function listarExecucoes(): Promise<ResumoExecucaoE2e[]> {
  let arquivos: string[]
  try {
    arquivos = await fs.readdir(pastaResultados())
  } catch {
    return []
  }
  const ids = arquivos
    .filter(f => f.endsWith('.json') && ID_EXECUCAO.test(f.slice(0, -5)))
    .map(f => f.slice(0, -5))
    .sort()
    .reverse()
    .slice(0, MAX_HISTORICO)

  const execucoes = await Promise.all(ids.map(lerExecucao))
  return execucoes
    .filter((e): e is ExecucaoE2e => !!e)
    .map(({ testes: _testes, ...resumo }) => resumo)
}

/**
 * Captura (PNG) ou trace (zip) de uma execução: só dentro de e2e/resultados/<id>/artefatos.
 * Devolve o caminho absoluto e o tipo, ou null se o caminho não for permitido.
 */
const ARTEFATO = /^resultados\/(\d{8}-\d{6}-[a-z0-9-]{1,40})\/artefatos\/([^/\\]+)\/((?:test-finished|test-failed)-\d+\.png|trace\.zip)$/

export function caminhoDoArtefato(relativo: string): { caminho: string, tipo: 'image/png' | 'application/zip' } | null {
  const m = relativo.match(ARTEFATO)
  if (!m || m[2] === '.' || m[2] === '..') return null
  const base = pastaResultados()
  const caminho = path.resolve(base, m[1]!, 'artefatos', m[2]!, m[3]!)
  if (!caminho.startsWith(base + path.sep)) return null
  return { caminho, tipo: m[3] === 'trace.zip' ? 'application/zip' : 'image/png' }
}
