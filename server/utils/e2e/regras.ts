import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { CombinacaoE2e, OraculoE2e, RegraE2e, RegraGravacaoE2e } from '../../../types'
import { pastaE2e } from './catalogo'

/**
 * Regras de tela da rematrícula (e2e/PLANO.md 3.5). A fonte é e2e/regras/regras.mjs, a mesma que os
 * testes e o gravador usam: o servidor não reescreve as regras, só carrega o módulo do motor e2e.
 * Carregado em tempo de execução (fora do bundle do Nitro): mudar as regras exige reiniciar o servidor.
 */

interface ModuloRegras {
  listaDeRegras(): RegraE2e[]
  avaliarHar(har: unknown, ajuste?: Record<string, unknown>): Omit<OraculoE2e, 'declarada'>
  IDS_REGRAS: Set<string>
}

let modulo: Promise<ModuloRegras> | undefined

export function moduloRegras(): Promise<ModuloRegras> {
  modulo ??= import(/* @vite-ignore */ pathToFileURL(path.join(pastaE2e(), 'regras', 'regras.mjs')).href) as Promise<ModuloRegras>
  return modulo
}

export async function listarRegras(): Promise<RegraE2e[]> {
  return (await moduloRegras()).listaDeRegras()
}

/** Regras que existem: para validar o que a tela manda gravar no catálogo. */
export async function idsDeRegras(): Promise<Set<string>> {
  return (await moduloRegras()).IDS_REGRAS
}

/** Regra que o dado de uma gravação (HAR já lido) aciona. Nunca lança. */
export async function regraDoHar(har: unknown): Promise<RegraGravacaoE2e | undefined> {
  try {
    const r = (await moduloRegras()).avaliarHar(har)
    return { id: r.regra.id, titulo: r.regra.titulo, rota: r.rota, aplicaveis: r.aplicaveis.map(a => a.id) }
  } catch {
    return undefined
  }
}

/** e2e/cenarios/combinacoes.json (sem o arquivo: nenhuma combinação). */
export async function lerCombinacoes(): Promise<CombinacaoE2e[]> {
  try {
    const conteudo = JSON.parse(await fs.readFile(path.join(pastaE2e(), 'cenarios', 'combinacoes.json'), 'utf8')) as { combinacoes?: CombinacaoE2e[] }
    return Array.isArray(conteudo.combinacoes) ? conteudo.combinacoes : []
  } catch {
    return []
  }
}
