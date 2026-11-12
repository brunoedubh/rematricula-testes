import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { CenarioE2e, DescarteE2e } from '../../../types'
import { atualizarCenario, gravarDescartados, lerAlunosLocais, lerDescartados, pastaE2e, removerAlunoLocal } from './catalogo'
import { PASTA_CANDIDATOS, existe } from './arquivos'
import { estadoEsteira } from './esteira'
import { CadastroError } from './cadastro'

/**
 * Descartar um aluno de um cenário (aba Massa de teste, Não encontrados e captura):
 * alguém viu na captura que o aluno não condiz com o cenário (a view é de produção e o HML vira na segunda).
 *
 * - Aluno aprovado (gravacoes/<id>.har): apaga a gravação e a captura, tira do alunos.local.json e o cenário
 *   volta a "a-gravar" (o teste dele deixa de rodar até achar outro aluno).
 * - Candidato (gravacoes/candidatos/<id>--<aluno>.*): apaga a gravação e a captura.
 * - Nos dois casos, o código entra em cenarios/descartados.local.json e a esteira passa a excluí-lo do SQL
 *   (COD_ALUNO NOT IN (...)) para este cenário.
 */

const apagar = async (relativo: string) => fs.rm(path.join(pastaE2e(), ...relativo.split('/')), { force: true })

export interface ResultadoDescarte {
  cenario: CenarioE2e
  papel: DescarteE2e['papel']
}

export async function descartarAluno(id: string, codigoAluno: number, email: string, motivo?: string): Promise<ResultadoDescarte> {
  if (estadoEsteira().rodando) {
    throw new CadastroError('A esteira está rodando. Espere terminar para descartar.', 409)
  }
  const alunos = await lerAlunosLocais()
  const aprovado = alunos[id] === codigoAluno && await existe(`gravacoes/${id}.har`)
  const candidato = `${PASTA_CANDIDATOS}/${id}--${codigoAluno}`
  if (!aprovado && !(await existe(`${candidato}.har`)) && !(await existe(`${candidato}.png`))) {
    throw new CadastroError(`O aluno ${codigoAluno} não tem gravação no cenário ${id}.`, 404)
  }
  const por = email.split('@')[0] ?? email
  const papel: DescarteE2e['papel'] = aprovado ? 'aprovado' : 'candidato'

  let cenario: CenarioE2e
  try {
    cenario = await atualizarCenario(id, (c) => {
      if (!aprovado) return
      c.status = 'a-gravar'
      delete c.gravadoEm
      delete c.avancos
      c.observado = { em: new Date().toISOString().slice(0, 10), motivo: `Aluno gravado descartado por ${por}${motivo ? `: ${motivo}` : ''}. Gere de novo ou informe outro aluno.` }
    })
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Cenário não encontrado')) throw new CadastroError(e.message, 404)
    throw e
  }

  if (aprovado) {
    await apagar(`gravacoes/${id}.har`)
    await apagar(`gravacoes/${id}.png`)
    await removerAlunoLocal(id)
  } else {
    await apagar(`${candidato}.har`)
    await apagar(`${candidato}.png`)
  }

  const descartados = await lerDescartados()
  const lista = (descartados[id] ?? []).filter(d => d.codigoAluno !== codigoAluno)
  lista.push({ codigoAluno, em: new Date().toISOString(), por, papel, ...(motivo ? { motivo } : {}) })
  descartados[id] = lista
  await gravarDescartados(descartados)

  console.log(`[AUDIT] ${email} (e2e) descartou o aluno ${codigoAluno} (${papel}) do cenário ${id}${motivo ? `: ${motivo}` : ''}`)
  return { cenario, papel }
}

/** Volta a permitir um aluno descartado (só tira da lista; a gravação já foi apagada). */
export async function restaurarDescartado(id: string, codigoAluno: number, email: string): Promise<void> {
  const descartados = await lerDescartados()
  const lista = (descartados[id] ?? []).filter(d => d.codigoAluno !== codigoAluno)
  const restantes = Object.fromEntries(Object.entries(descartados).filter(([chave]) => chave !== id))
  await gravarDescartados(lista.length ? { ...restantes, [id]: lista } : restantes)
  console.log(`[AUDIT] ${email} (e2e) voltou a permitir o aluno ${codigoAluno} no cenário ${id}`)
}
