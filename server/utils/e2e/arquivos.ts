import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ArquivosCenarioE2e } from '../../../types'
import { pastaE2e } from './catalogo'

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

  const resultado: Record<string, ArquivosCenarioE2e> = {}
  for (const id of ids) {
    resultado[id] = {
      gravacao: gravacoes.has(`${id}.har`),
      captura: gravacoes.has(`${id}.png`) ? `gravacoes/${id}.png` : undefined,
      candidatos: []
    }
  }

  const porAluno = new Map<string, { codigoAluno: number, gravacao: boolean, captura?: string }>()
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
    if (m[3] === 'har') item.gravacao = true
    else item.captura = `${PASTA_CANDIDATOS}/${arquivo}`
  }
  return resultado
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
