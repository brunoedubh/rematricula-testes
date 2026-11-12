import type { CenarioE2e } from '../../../types'
import { atualizarCenario, fonteDoCenario, incluirCenario, lerCatalogo, perfilDescritivo, perfilParaWhere, registrarAlunoLocal } from './catalogo'
import { WhereInvalidoError, validarWhere } from './where'
import { PASTA_CANDIDATOS, avancosDaGravacao, existe, lerAnotacao } from './arquivos'
import { idsDeRegras } from './regras'
import { estadoEsteira, promoverGravacao } from './esteira'

/**
 * Edição do catálogo pela tela "Cenários E2E" (PLANO.md 4):
 * novo cenário, cenário a partir da gravação de um candidato, e conferência de um `a-confirmar`.
 * Erros de regra saem como CadastroError (a rota devolve 400/409 com a mensagem).
 */

export class CadastroError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message)
  }
}

export interface EsperadoInformado {
  rota?: string
  textos?: string[]
  botoes?: string[]
  desabilitados?: string[]
  naoDeve?: { textos?: string[], botoes?: string[] }
}

const limpar = (l?: string[]) => (l ?? []).map(t => t.trim()).filter(Boolean)

/** Regra(s) que o cenário exercita: só ids que existem em e2e/regras/regras.mjs. Vazio = sem regra. */
async function normalizarRegra(regra: string | string[] | undefined): Promise<string | string[] | undefined> {
  const lista = [...new Set(limpar([regra ?? []].flat()))]
  if (!lista.length) return undefined
  const ids = await idsDeRegras()
  const desconhecida = lista.find(r => !ids.has(r))
  if (desconhecida) throw new CadastroError(`Regra desconhecida: ${desconhecida}`)
  return lista.length === 1 ? lista[0] : lista
}

/**
 * O aluno da gravação precisa cair na regra do cenário (oráculo e2e/regras/regras.mjs).
 * É o que impede de "confirmar" a tela que o aluno viu quando o aluno não é do cenário.
 */
async function conferirRegra(regra: string | string[] | undefined, har: string): Promise<void> {
  const declaradas = [regra ?? []].flat()
  if (!declaradas.length) return
  const doAluno = (await lerAnotacao(har)).regra
  if (doAluno && !declaradas.includes(doAluno.id)) {
    throw new CadastroError(`O aluno gravado cai na regra "${doAluno.titulo}" (tela ${doAluno.rota}), não em ${declaradas.join(' ou ')}. Descarte o aluno ou revise a regra do cenário.`)
  }
}

const hoje = () => new Date().toISOString().slice(0, 10)

/** Limpa listas vazias e valida a regex da rota (o teste usa new RegExp(rota, 'i') na URL). */
function normalizarEsperado(e?: EsperadoInformado): CenarioE2e['esperado'] | undefined {
  if (!e) return undefined
  const rota = e.rota?.trim() || undefined
  if (rota) {
    try {
      new RegExp(rota, 'i')
    } catch {
      throw new CadastroError(`Rota esperada não é uma expressão regular válida: ${rota}`)
    }
  }
  const textos = limpar(e.textos)
  const botoes = limpar(e.botoes)
  const desabilitados = limpar(e.desabilitados)
  const naoDeve = { textos: limpar(e.naoDeve?.textos), botoes: limpar(e.naoDeve?.botoes) }
  const esperado: NonNullable<CenarioE2e['esperado']> = {}
  if (rota) esperado.rota = rota
  if (textos.length) esperado.textos = textos
  if (botoes.length) esperado.botoes = botoes
  if (desabilitados.length) esperado.desabilitados = desabilitados
  if (naoDeve.textos.length || naoDeve.botoes.length) {
    esperado.naoDeve = {}
    if (naoDeve.textos.length) esperado.naoDeve.textos = naoDeve.textos
    if (naoDeve.botoes.length) esperado.naoDeve.botoes = naoDeve.botoes
  }
  return Object.keys(esperado).length ? esperado : undefined
}

/**
 * A rota esperada precisa casar com a tela onde a gravação parou.
 * A rota observada vem sem o prefixo do app; o teste confere o caminho relativo ao app ("/contrato").
 */
function conferirRota(rota: string, observada: string | undefined): void {
  if (observada === undefined) return
  if (!new RegExp(rota, 'i').test(`/${observada.replace(/^\/+/, '')}`)) {
    throw new CadastroError(`A rota esperada "${rota}" não casa com a tela gravada (${observada || 'raiz'}).`)
  }
}

function semEsteiraRodando(): void {
  if (estadoEsteira().rodando) {
    throw new CadastroError('A esteira está rodando. Espere terminar para mexer nas gravações.', 409)
  }
}

export interface NovoCenario {
  id: string
  titulo: string
  perfil: Record<string, unknown>
  /** WHERE da busca no Databricks (opcional): com ele, o cenário é de fonte databricks */
  where?: string
  esperado?: EsperadoInformado
  /** Regra(s) de tela que o cenário exercita (e2e/regras/regras.mjs) */
  regra?: string | string[]
  /** Cria a partir da gravação de um candidato (gravacoes/candidatos/<cenario>--<aluno>.har) */
  aPartirDe?: { cenario: string, codigoAluno: number, rota?: string }
}

export async function criarCenario(novo: NovoCenario, email: string): Promise<CenarioE2e> {
  // Perfil com coluna inválida falha aqui, não na hora da geração.
  let where: string | undefined
  try {
    perfilParaWhere(novo.perfil)
    if (novo.where?.trim()) where = validarWhere(novo.where)
  } catch (e) {
    throw new CadastroError(e instanceof Error ? e.message : String(e))
  }

  const esperado = normalizarEsperado(novo.esperado)
  const regra = await normalizarRegra(novo.regra)
  const cenario: CenarioE2e = {
    id: novo.id,
    titulo: novo.titulo.trim(),
    ...(regra ? { regra } : {}),
    status: 'a-gravar',
    perfil: where ? perfilDescritivo(novo.perfil) : novo.perfil,
    ...(where ? { where } : {}),
    fonte: fonteDoCenario({ perfil: novo.perfil, where }),
    geradoPor: email.split('@')[0]
  }
  if (esperado) cenario.esperado = esperado

  if ((await lerCatalogo()).cenarios.some(c => c.id === novo.id)) {
    throw new CadastroError(`Já existe um cenário com o id "${novo.id}"`, 409)
  }
  if (!novo.aPartirDe) return incluirCenario(cenario)

  semEsteiraRodando()
  const { cenario: origem, codigoAluno, rota } = novo.aPartirDe
  const har = `${PASTA_CANDIDATOS}/${origem}--${codigoAluno}.har`
  const png = `${PASTA_CANDIDATOS}/${origem}--${codigoAluno}.png`
  if (!(await existe(har))) {
    throw new CadastroError(`Gravação não encontrada: ${har}`, 404)
  }
  if (await existe(`gravacoes/${novo.id}.har`)) {
    throw new CadastroError(`Já existe gravação para "${novo.id}"`, 409)
  }
  if (esperado?.rota) conferirRota(esperado.rota, rota)
  await conferirRegra(regra, har)

  cenario.status = esperado?.rota ? 'gravado' : 'a-confirmar'
  cenario.gravadoEm = hoje()
  const avancos = await avancosDaGravacao(har)
  if (avancos.length) cenario.avancos = avancos
  if (!esperado?.rota) cenario.observado = { em: hoje(), rota }

  // Catálogo primeiro: se o id já existir, nada é movido.
  await incluirCenario(cenario)
  await promoverGravacao(novo.id, har, (await existe(png)) ? png : undefined)
  await registrarAlunoLocal(novo.id, codigoAluno)
  console.log(`[AUDIT] ${email} (e2e) criou o cenário ${novo.id} a partir da gravação ${origem}--${codigoAluno}`)
  return cenario
}

export interface AlteracaoCenario {
  titulo?: string
  /**
   * Novo WHERE da busca no Databricks. Texto: grava (e o cenário vira databricks; as colunas do perfil saem,
   * ficam só as descrições). Vazio: tira o WHERE (o cenário volta a usar o perfil; sem colunas, vira manual).
   */
  where?: string
  esperado?: EsperadoInformado
  /** Regra(s) de tela que o cenário exercita; vazio tira a regra */
  regra?: string | string[]
  /** a-confirmar → gravado: alguém conferiu a captura e preencheu a rota esperada */
  confirmar?: boolean
}

export async function alterarCenario(id: string, alteracao: AlteracaoCenario, email: string): Promise<CenarioE2e> {
  const esperado = alteracao.esperado ? normalizarEsperado(alteracao.esperado) : undefined
  const regra = alteracao.regra !== undefined ? await normalizarRegra(alteracao.regra) : undefined
  // Confirmar exige regra, e o aluno gravado precisa cair nela (antes de mexer no catálogo).
  if (alteracao.confirmar) {
    const atual = (await lerCatalogo()).cenarios.find(c => c.id === id)
    const final = alteracao.regra !== undefined ? regra : atual?.regra
    if (!final) throw new CadastroError('Informe a regra que o cenário testa para confirmar: é ela que diz se a tela está certa.')
    await conferirRegra(final, `gravacoes/${id}.har`)
  }
  let where: string | undefined
  if (alteracao.where?.trim()) {
    try {
      where = validarWhere(alteracao.where)
    } catch (e) {
      if (e instanceof WhereInvalidoError) throw new CadastroError(e.message)
      throw e
    }
  }
  if (alteracao.confirmar && !(await existe(`gravacoes/${id}.har`))) {
    throw new CadastroError('Cenário sem gravação: não há o que confirmar.', 409)
  }

  try {
    return await atualizarCenario(id, (c) => {
      if (alteracao.titulo?.trim()) c.titulo = alteracao.titulo.trim()
      if (alteracao.where !== undefined) {
        const antes = c.where
        if (where) {
          c.where = where
          c.perfil = perfilDescritivo(c.perfil ?? {})
        } else {
          delete c.where
        }
        c.fonte = fonteDoCenario(c)
        if (antes !== c.where) {
          // A contagem era do filtro antigo.
          delete c.alunosNoPerfil
          console.log(`[AUDIT] ${email} (e2e) alterou o WHERE do cenário ${id}: ${c.where ?? '(removido)'}`)
        }
      }
      if (alteracao.esperado) {
        if (esperado) c.esperado = esperado
        else delete c.esperado
      }
      if (alteracao.regra !== undefined) {
        if (regra) c.regra = regra
        else delete c.regra
      }
      if (c.status === 'gravado' && !c.esperado?.rota) {
        throw new CadastroError('Cenário gravado precisa de rota esperada (o teste confere a URL).')
      }
      if (alteracao.confirmar) {
        if (c.status !== 'a-confirmar') {
          throw new CadastroError(`Só cenário "a-confirmar" pode ser confirmado (este está "${c.status}").`, 409)
        }
        if (!c.esperado?.rota) throw new CadastroError('Informe a rota esperada para confirmar.')
        conferirRota(c.esperado.rota, c.observado?.rota)
        c.status = 'gravado'
        c.geradoPor = email.split('@')[0]
        delete c.observado
      }
    })
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Cenário não encontrado')) throw new CadastroError(e.message, 404)
    throw e
  }
}
