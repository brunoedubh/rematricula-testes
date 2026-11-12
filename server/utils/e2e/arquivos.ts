import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AlunoHmlE2e, ArquivosCenarioE2e, CandidatoGravadoE2e, RegraGravacaoE2e, ResultadoTentativaE2e } from '../../../types'
import { lerAlunosLocais, pastaE2e } from './catalogo'
import { regraDoHar } from './regras'

/**
 * Gravações e capturas em e2e/gravacoes, para a tela "Cenários E2E" (PLANO.md 4).
 *   gravacoes/<id>.har|.png                       → gravação aprovada do cenário
 *   gravacoes/candidatos/<id>--<aluno>.har|.png   → candidatos que não foram aprovados
 */

export const PASTA_CANDIDATOS = 'gravacoes/candidatos'

const CANDIDATO = /^([a-z0-9-]+)--(\d+)\.(har|png)$/

async function listar(pasta: string): Promise<string[]> {
  try {
    return await fs.readdir(pasta)
  } catch {
    return []
  }
}

export async function arquivosDosCenarios(ids: string[]): Promise<Record<string, ArquivosCenarioE2e>> {
  const base = pastaE2e()
  const gravacoes = new Set(await listar(path.join(base, 'gravacoes')))
  const candidatos = await listar(path.join(base, PASTA_CANDIDATOS))
  const alunosLocais = await lerAlunosLocais()

  const resultado: Record<string, ArquivosCenarioE2e> = {}
  for (const id of ids) {
    resultado[id] = {
      gravacao: gravacoes.has(`${id}.har`),
      captura: gravacoes.has(`${id}.png`) ? `gravacoes/${id}.png` : undefined,
      codigoAluno: gravacoes.has(`${id}.har`) ? alunosLocais[id] : undefined,
      candidatos: []
    }
    // Regra que o dado da gravação aprovada aciona (a tela mostra e o "confirmar" confere).
    if (gravacoes.has(`${id}.har`)) resultado[id]!.regra = (await lerAnotacao(`gravacoes/${id}.har`)).regra
  }

  const porAluno = new Map<string, CandidatoGravadoE2e>()
  for (const arquivo of candidatos) {
    const m = arquivo.match(CANDIDATO)
    if (!m || !resultado[m[1]!]) continue
    const chave = `${m[1]}--${m[2]}`
    let item = porAluno.get(chave)
    if (!item) {
      item = { codigoAluno: Number(m[2]), gravacao: false }
      porAluno.set(chave, item)
      resultado[m[1]!]!.candidatos.push(item)
    }
    if (m[3] === 'har') {
      item.gravacao = true
      Object.assign(item, await lerAnotacao(`${PASTA_CANDIDATOS}/${arquivo}`))
    } else {
      item.captura = `${PASTA_CANDIDATOS}/${arquivo}`
    }
  }
  return resultado
}

// ---------------------------------------------------------------------------
// Anotação que o gravador deixa no HAR (log._e2e) + resumo do aluno sem dados pessoais
// (mesma regra de e2e/scripts/aluno.mjs). HAR antigo, sem anotação: o aluno sai de ObterInformacoesAluno.
// ---------------------------------------------------------------------------

export interface AnotacaoGravacao {
  rota?: string
  resultado?: ResultadoTentativaE2e
  gravadoEm?: string
  aluno?: AlunoHmlE2e
  /** Regra de tela que o dado gravado aciona (calculada do HAR: vale também para gravações antigas) */
  regra?: RegraGravacaoE2e
}

type Json = Record<string, unknown>

const num = (v: unknown) => typeof v === 'number' ? v : null
const txt = (v: unknown) => typeof v === 'string' ? v : null
const bool = (v: unknown) => typeof v === 'boolean' ? v : null

function resumoAluno(info: Json): AlunoHmlE2e {
  return {
    codigoAluno: num(info.codigoAluno),
    periodoLetivo: txt(info.periodoLetivo),
    codigoPeriodoLetivo: num(info.codigoPeriodoLetivo),
    curso: txt(info.curso),
    codigoCurso: num(info.codigoCurso),
    instituicao: txt(info.siglaInstituicao) ?? txt(info.instituicao),
    campus: txt(info.campus),
    persona: num(info.identificadorPersona) ?? num(info.persona),
    estaNoSoftLaunch: bool(info.estaNoSoftLaunch),
    pendenciaFinanceira: bool(info.possuiPendenciasFinanceiras) ?? bool(info.pendenciaFinanceira),
    contratoLiberado: bool(info.contratoEstaLiberado) ?? bool(info.contratoLiberado),
    contratoAceito: bool(info.contratoEstaAceito) ?? bool(info.contratoAceito),
    bloqueios: Array.isArray(info.tiposBloqueioAcesso)
      ? info.tiposBloqueioAcesso.filter((b): b is number => typeof b === 'number')
      : Array.isArray(info.bloqueios) ? info.bloqueios.filter((b): b is number => typeof b === 'number') : []
  }
}

/** Lê rota, resultado e aluno anotados num HAR (relativo a e2e/). Nunca lança: HAR ilegível = {}. */
export async function lerAnotacao(relativo: string): Promise<AnotacaoGravacao> {
  try {
    const har = JSON.parse(await fs.readFile(path.join(pastaE2e(), ...relativo.split('/')), 'utf8')) as {
      log?: { _e2e?: Json, entries?: { request?: { url?: string }, response?: { status?: number, content?: { text?: string } } }[] }
    }
    const nota = har.log?._e2e ?? {}
    let aluno = nota.aluno && typeof nota.aluno === 'object' ? resumoAluno(nota.aluno as Json) : undefined
    if (!aluno) {
      const entrada = har.log?.entries?.find(e => /ObterInformacoesAluno/i.test(e.request?.url ?? '') && e.response?.status === 200)
      if (entrada?.response?.content?.text) {
        try {
          aluno = resumoAluno(JSON.parse(entrada.response.content.text) as Json)
        } catch {
          // corpo que não é JSON
        }
      }
    }
    return {
      rota: txt(nota.rota) ?? undefined,
      resultado: (txt(nota.resultado) ?? undefined) as ResultadoTentativaE2e | undefined,
      gravadoEm: txt(nota.gravadoEm) ?? undefined,
      aluno,
      regra: await regraDoHar(har)
    }
  } catch {
    return {}
  }
}

export async function listarGravacoes(): Promise<{ gravacoes: string[], candidatos: string[] }> {
  const base = pastaE2e()
  return {
    gravacoes: await listar(path.join(base, 'gravacoes')),
    candidatos: await listar(path.join(base, PASTA_CANDIDATOS))
  }
}

/** Só PNG dentro de e2e/gravacoes, com nome no formato da esteira: nada de caminho arbitrário. */
const CAPTURA_PERMITIDA = /^gravacoes\/(candidatos\/[a-z0-9-]+--\d+|[a-z0-9-]+)\.png$/

export function caminhoDaCaptura(relativo: string): string | null {
  if (!CAPTURA_PERMITIDA.test(relativo)) return null
  return path.join(pastaE2e(), ...relativo.split('/'))
}

/** Telas avançadas na gravação: o gravador anota em log._avancos do HAR (e2e/scripts/avancos.mjs). */
export async function avancosDaGravacao(relativo: string): Promise<string[]> {
  try {
    const har = JSON.parse(await fs.readFile(path.join(pastaE2e(), ...relativo.split('/')), 'utf8')) as { log?: { _avancos?: unknown } }
    const avancos = har.log?._avancos
    return Array.isArray(avancos) ? avancos.filter((a): a is string => typeof a === 'string') : []
  } catch {
    return []
  }
}

export async function existe(relativo: string): Promise<boolean> {
  try {
    await fs.access(path.join(pastaE2e(), ...relativo.split('/')))
    return true
  } catch {
    return false
  }
}
