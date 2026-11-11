import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { CatalogoE2e, CenarioE2e, FonteCenarioE2e } from '../../../types'

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

/**
 * Colunas da sb_jira.wv_alunos_rem aceitas no perfil (conferidas com DESCRIBE em 11/11/2026).
 * A view NÃO tem IND_CONFIRMADO_UCDP, IND_CONFIRMADO_CORE nem IND_*_PEND_ACAD_E2A2:
 * para esses casos, o perfil usa só a oferta e quem decide é a tela real (classificação).
 */
const COLUNAS_PERFIL = new Set([
  'COD_ALUNO',
  'COD_CURSO',
  'COD_CAMPUS',
  'COD_MARCA',
  'COD_PERIODO_LETIVO',
  'COD_TPO_PERSONA',
  'COD_CATEGORIA_GRADE',
  'DSC_TPO_GRD_CURRICULAR',
  'DSC_CATEGORIA_GRADE',
  'DSC_STA_MATRICULA',
  'IND_REG_FINANCEIRO',
  'IND_EXECUTOU_LIBERACAO',
  'IND_EXECUTOU_PROMOCAO',
  'IND_CALOURO',
  'IND_MEDICINA',
  'IND_CONFIRMADO_OFERTA_PRINC',
  'IND_OFERTA_UCDP',
  'IND_OFERTA_CORE',
  'IND_POSSUI_HORARIO',
  'IND_NAO_POSSUI_HORARIO',
  'IND_CONTRATO_LIBERADO',
  'IND_CONTRATO_ASSINADO',
  'QTDE_DP_NA_MAT'
])

/** Chave com cara de coluna da view: se não estiver na lista, é erro de digitação, não descrição. */
const PARECE_COLUNA = /^(IND|COD|QTDE|DSC|NUM|NOM|SGL)_[A-Z0-9_]+$/

export class PerfilInvalidoError extends Error {}

/**
 * databricks: todas as chaves do perfil são colunas da view.
 * manual: há chave descritiva (softLaunch, api, rota…), que a view não enxerga.
 */
export function fonteDoPerfil(perfil: Record<string, unknown>): FonteCenarioE2e {
  const chaves = Object.keys(perfil)
  if (chaves.length === 0) return 'manual'
  return chaves.every(c => COLUNAS_PERFIL.has(c)) ? 'databricks' : 'manual'
}

function condicao(coluna: string, valor: unknown): string {
  if (valor === null) return `${coluna} IS NULL`
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

  throw new PerfilInvalidoError(`Valor não suportado em ${coluna}: "${valor}" (use 'S'/'N', null, número, ">0" ou "~texto")`)
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
    c.fonte ??= fonteDoPerfil(c.perfil ?? {})
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

/** Código real do aluno usado em cada cenário. Fica fora do git (e2e/.gitignore). */
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
