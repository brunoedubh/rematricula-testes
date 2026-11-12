import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { CatalogoE2e, CenarioE2e, DescarteE2e, FonteCenarioE2e } from '../../../types'
import { COLUNAS_VIEW, validarWhere } from './where'

/**
 * Catálogo de cenários do e2e (e2e/PLANO.md 3.1.1).
 * A fonte da verdade é o arquivo e2e/cenarios/catalogo.json; nada é guardado em banco.
 */

/** Pasta do motor e2e. Padrão: ./e2e a partir de onde o Nuxt foi iniciado. */
export function pastaE2e(): string {
  return path.resolve(process.env.E2E_DIR || path.join(process.cwd(), 'e2e'))
}

const arquivoCatalogo = () => path.join(pastaE2e(), 'cenarios', 'catalogo.json')
const arquivoAlunos = () => path.join(pastaE2e(), 'cenarios', 'alunos.local.json')

/** Colunas aceitas: a mesma lista que a tela mostra (types/e2e.ts → COLUNAS_VIEW_E2E). */
const COLUNAS_PERFIL = COLUNAS_VIEW

/** Chave com cara de coluna da view: se não estiver na lista, é erro de digitação, não descrição. */
const PARECE_COLUNA = /^(IND|COD|QTDE|DSC|NUM|NOM|SGL)_[A-Z0-9_]+$/

export class PerfilInvalidoError extends Error {}

/**
 * databricks: todas as chaves do perfil são colunas da view.
 * manual: há chave descritiva (softLaunch, api, rota…), que a view não enxerga.
 */
export function fonteDoCenario(c: Pick<CenarioE2e, 'perfil' | 'where'>): FonteCenarioE2e {
  return c.where?.trim() ? 'databricks' : fonteDoPerfil(c.perfil ?? {})
}

/** Só as chaves descritivas do perfil (as de coluna saem quando o cenário ganha um WHERE escrito à mão). */
export function perfilDescritivo(perfil: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(perfil).filter(([k]) => !COLUNAS_PERFIL.has(k)))
}

export function fonteDoPerfil(perfil: Record<string, unknown>): FonteCenarioE2e {
  const chaves = Object.keys(perfil)
  if (chaves.length === 0) return 'manual'
  return chaves.every(c => COLUNAS_PERFIL.has(c)) ? 'databricks' : 'manual'
}

function condicao(coluna: string, valor: unknown): string {
  if (valor === null) return `${coluna} IS NULL`
  // Lista → IN (números ou 'S'/'N'); "!" na frente do primeiro item → NOT IN. Ex.: [13064, 13082] ou ["!", 13064]
  if (Array.isArray(valor)) {
    const negar = valor[0] === '!'
    const itens = negar ? valor.slice(1) : valor
    if (!itens.length || itens.length > 200) throw new PerfilInvalidoError(`Lista vazia ou grande demais em ${coluna}`)
    const literais = itens.map((v) => {
      if (typeof v === 'number' && Number.isInteger(v)) return String(v)
      if (typeof v === 'string' && /^-?\d{1,12}$/.test(v)) return String(Number(v))
      if (v === 'S' || v === 'N') return `'${v}'`
      throw new PerfilInvalidoError(`Valor não suportado na lista de ${coluna}: ${JSON.stringify(v)} (use números ou 'S'/'N')`)
    })
    return `${coluna} ${negar ? 'NOT IN' : 'IN'} (${literais.join(', ')})`
  }
  if (typeof valor === 'number' && Number.isInteger(valor)) return `${coluna} = ${valor}`
  if (typeof valor !== 'string') {
    throw new PerfilInvalidoError(`Valor não suportado em ${coluna}: ${JSON.stringify(valor)}`)
  }
  if (valor === 'S' || valor === 'N') return `${coluna} = '${valor}'`

  const comparacao = valor.match(/^(>=|<=|<>|>|<|=)\s*(-?\d{1,12})$/)
  if (comparacao) return `${coluna} ${comparacao[1]} ${Number(comparacao[2])}`

  if (/^-?\d{1,12}$/.test(valor)) return `${coluna} = ${Number(valor)}`

  // "~texto" → LIKE sem diferenciar maiúsculas. Só letras, números, espaço, _ e -: nada que precise escapar.
  const parecido = valor.match(/^~([\p{L}\d _-]{1,50})$/u)
  if (parecido) return `LOWER(${coluna}) LIKE '%${parecido[1]!.toLowerCase()}%'`

  throw new PerfilInvalidoError(`Valor não suportado em ${coluna}: "${valor}" (use 'S'/'N', null, número, ">0", "~texto" ou lista [1, 2])`)
}

/**
 * Perfil do catálogo → condições do WHERE (PLANO.md 3.1.1).
 * Ignora chaves descritivas; chave com cara de coluna fora da lista = erro.
 */
export function perfilParaWhere(perfil: Record<string, unknown>): string[] {
  const condicoes: string[] = []
  for (const [chave, valor] of Object.entries(perfil)) {
    if (COLUNAS_PERFIL.has(chave)) {
      condicoes.push(condicao(chave, valor))
    } else if (PARECE_COLUNA.test(chave)) {
      throw new PerfilInvalidoError(`Coluna desconhecida no perfil: ${chave}`)
    }
  }
  return condicoes
}

export async function lerCatalogo(): Promise<CatalogoE2e> {
  const texto = await fs.readFile(arquivoCatalogo(), 'utf8')
  const catalogo = JSON.parse(texto) as CatalogoE2e
  for (const c of catalogo.cenarios) {
    c.fonte ??= fonteDoCenario(c)
  }
  return catalogo
}

/** Um cenário por linha, para o diff no git mostrar só o cenário que mudou. */
function serializar(catalogo: CatalogoE2e): string {
  const { cenarios, ...resto } = catalogo
  const topo = JSON.stringify(resto, null, 2).replace(/\n}$/, '')
  const linhas = cenarios.map(c => `    ${JSON.stringify(c)}`).join(',\n')
  return `${topo},\n  "cenarios": [\n${linhas}\n  ]\n}\n`
}

async function escreverAtomico(arquivo: string, conteudo: string): Promise<void> {
  const tmp = `${arquivo}.${process.pid}.tmp`
  await fs.writeFile(tmp, conteudo, 'utf8')
  await fs.rename(tmp, arquivo)
}

/**
 * Relê o catálogo, aplica a alteração em um cenário e grava.
 * Reler antes de gravar preserva edições feitas à mão no arquivo enquanto a esteira rodava.
 */
export async function atualizarCenario(id: string, alterar: (c: CenarioE2e) => void): Promise<CenarioE2e> {
  const catalogo = await lerCatalogo()
  const cenario = catalogo.cenarios.find(c => c.id === id)
  if (!cenario) throw new Error(`Cenário não encontrado no catálogo: ${id}`)
  alterar(cenario)
  await escreverAtomico(arquivoCatalogo(), serializar(catalogo))
  return cenario
}

/** WHERE do cenário em texto: o escrito à mão ou o montado a partir das colunas do perfil. */
export function whereDoCenario(c: Pick<CenarioE2e, 'perfil' | 'where'>): string {
  if (c.where?.trim()) return validarWhere(c.where)
  return perfilParaWhere(c.perfil ?? {}).join('\n  AND ')
}

/**
 * Condições do WHERE de um cenário: WHERE (ou colunas do perfil) + alunos descartados (NOT IN) + período opcional.
 * É o que a esteira usa e o que a tela mostra em "Filtro SQL".
 */
export function condicoesDoCenario(c: Pick<CenarioE2e, 'perfil' | 'where'>, descartados: number[] = [], periodo?: number): string[] {
  const condicoes = c.where?.trim() ? [`(${validarWhere(c.where)})`] : perfilParaWhere(c.perfil ?? {})
  if (periodo) condicoes.push(`COD_PERIODO_LETIVO = ${Math.trunc(periodo)}`)
  const codigos = [...new Set(descartados.filter(n => Number.isInteger(n) && n > 0))]
  if (codigos.length) condicoes.push(`COD_ALUNO NOT IN (${codigos.join(', ')})`)
  return condicoes
}

// ---------------------------------------------------------------------------
// Alunos descartados (cenarios/descartados.local.json, fora do git): códigos que alguém viu na captura
// que não servem para o cenário. A esteira não sorteia mais esses alunos para ele.
// ---------------------------------------------------------------------------

const arquivoDescartados = () => path.join(pastaE2e(), 'cenarios', 'descartados.local.json')

export async function lerDescartados(): Promise<Record<string, DescarteE2e[]>> {
  try {
    const bruto = JSON.parse(await fs.readFile(arquivoDescartados(), 'utf8')) as Record<string, unknown>
    const r: Record<string, DescarteE2e[]> = {}
    for (const [id, lista] of Object.entries(bruto)) {
      if (Array.isArray(lista)) r[id] = lista.filter((d): d is DescarteE2e => typeof d?.codigoAluno === 'number')
    }
    return r
  } catch {
    return {}
  }
}

export async function gravarDescartados(descartados: Record<string, DescarteE2e[]>): Promise<void> {
  await escreverAtomico(arquivoDescartados(), JSON.stringify(descartados, null, 2) + '\n')
}

export async function removerAlunoLocal(id: string): Promise<void> {
  const alunos = await lerAlunosLocais()
  if (!(id in alunos)) return
  const restantes = Object.fromEntries(Object.entries(alunos).filter(([chave]) => chave !== id))
  await escreverAtomico(arquivoAlunos(), JSON.stringify(restantes, null, 2) + '\n')
}

/** cenarios/alunos.local.json: id do cenário → código do aluno gravado (fora do git). */
export async function lerAlunosLocais(): Promise<Record<string, number>> {
  try {
    const bruto = JSON.parse(await fs.readFile(arquivoAlunos(), 'utf8')) as Record<string, unknown>
    return Object.fromEntries(Object.entries(bruto).filter((e): e is [string, number] => typeof e[1] === 'number'))
  } catch {
    return {}
  }
}

export async function registrarAlunoLocal(id: string, codigoAluno: number): Promise<void> {
  let alunos: Record<string, number> = {}
  try {
    alunos = JSON.parse(await fs.readFile(arquivoAlunos(), 'utf8'))
  } catch {
    // arquivo ainda não existe
  }
  alunos[id] = codigoAluno
  await escreverAtomico(arquivoAlunos(), JSON.stringify(alunos, null, 2) + '\n')
}

/** Inclui um cenário novo no fim do catálogo. Id repetido = erro. */
export async function incluirCenario(novo: CenarioE2e): Promise<CenarioE2e> {
  const catalogo = await lerCatalogo()
  if (catalogo.cenarios.some(c => c.id === novo.id)) {
    throw new Error(`Já existe um cenário com o id "${novo.id}"`)
  }
  catalogo.cenarios.push(novo)
  await escreverAtomico(arquivoCatalogo(), serializar(catalogo))
  return novo
}
