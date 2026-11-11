import type { CenarioE2e } from '../../../types'
import { atualizarCenario, fonteDoPerfil, incluirCenario, lerCatalogo, perfilParaWhere, registrarAlunoLocal } from './catalogo'
import { PASTA_CANDIDATOS, avancosDaGravacao, existe } from './arquivos'
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
  const textos = (e.textos ?? []).map(t => t.trim()).filter(Boolean)
  const botoes = (e.botoes ?? []).map(t => t.trim()).filter(Boolean)
  const esperado: NonNullable<CenarioE2e['esperado']> = {}
  if (rota) esperado.rota = rota
  if (textos.length) esperado.textos = textos
  if (botoes.length) esperado.botoes = botoes
  return Object.keys(esperado).length ? esperado : undefined
}

/**
 * A rota esperada precisa casar com a tela onde a gravação parou.
 * A rota observada vem sem o prefixo do app; o teste confere a URL inteira, então monta o caminho.
 */
function conferirRota(rota: string, observada: string | undefined): void {
  if (observada === undefined) return
  if (!new RegExp(rota, 'i').test(`/rematricula/${observada}`)) {
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
  esperado?: EsperadoInformado
  /** Cria a partir da gravação de um candidato (gravacoes/candidatos/<cenario>--<aluno>.har) */
  aPartirDe?: { cenario: string, codigoAluno: number, rota?: string }
}

export async function criarCenario(novo: NovoCenario, email: string): Promise<CenarioE2e> {
  // Perfil com coluna inválida falha aqui, não na hora da geração.
  try {
    perfilParaWhere(novo.perfil)
  } catch (e) {
    throw new CadastroError(e instanceof Error ? e.message : String(e))
  }

  const esperado = normalizarEsperado(novo.esperado)
  const cenario: CenarioE2e = {
    id: novo.id,
    titulo: novo.titulo.trim(),
    status: 'a-gravar',
    perfil: novo.perfil,
    fonte: fonteDoPerfil(novo.perfil),
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
  esperado?: EsperadoInformado
  /** a-confirmar → gravado: alguém conferiu a captura e preencheu a rota esperada */
  confirmar?: boolean
}

export async function alterarCenario(id: string, alteracao: AlteracaoCenario, email: string): Promise<CenarioE2e> {
  const esperado = alteracao.esperado ? normalizarEsperado(alteracao.esperado) : undefined
  if (alteracao.confirmar && !(await existe(`gravacoes/${id}.har`))) {
    throw new CadastroError('Cenário sem gravação: não há o que confirmar.', 409)
  }

  try {
    return await atualizarCenario(id, (c) => {
      if (alteracao.titulo?.trim()) c.titulo = alteracao.titulo.trim()
      if (alteracao.esperado) {
        if (esperado) c.esperado = esperado
        else delete c.esperado
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
