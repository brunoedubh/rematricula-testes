import type { AlunoMassaE2e, CenarioMassaE2e, RespostaMassaE2e } from '../../../types'
import { lerAlunosLocais, lerCatalogo, lerDescartados } from './catalogo'
import { PASTA_CANDIDATOS, lerAnotacao, listarGravacoes } from './arquivos'

/**
 * Massa de teste (aba "Massa de teste"): qual aluno foi usado em cada cenário e quais foram tentados.
 * Fontes: cenarios/alunos.local.json (aluno aprovado), gravacoes/<id>.har e gravacoes/candidatos/<id>--<aluno>.har
 * (rota, resultado e resumo do aluno anotados pelo gravador). Nada disso vai para o git.
 */

const CANDIDATO = /^([a-z0-9-]+)--(\d+)\.har$/
const EXTRA = /^extra-aluno-(\d+)\.har$/

export async function montarMassa(): Promise<RespostaMassaE2e> {
  const [catalogo, alunosLocais, { gravacoes, candidatos }, descartados] = await Promise.all([lerCatalogo(), lerAlunosLocais(), listarGravacoes(), lerDescartados()])
  const arquivos = new Set(gravacoes)
  const porId = new Map<string, CenarioMassaE2e>()

  for (const c of catalogo.cenarios) {
    const item: CenarioMassaE2e = { id: c.id, titulo: c.titulo, status: c.status, fonte: c.fonte, rotaEsperada: c.esperado?.rota, regra: c.regra, alunos: [] }
    porId.set(c.id, item)
    if (!arquivos.has(`${c.id}.har`)) continue
    const nota = await lerAnotacao(`gravacoes/${c.id}.har`)
    const codigo = alunosLocais[c.id] ?? nota.aluno?.codigoAluno ?? null
    if (codigo === null) continue
    item.alunos.push({
      codigoAluno: codigo,
      papel: 'aprovado',
      rota: nota.rota ?? (c.status === 'a-confirmar' ? c.observado?.rota : undefined),
      resultado: nota.resultado,
      captura: arquivos.has(`${c.id}.png`) ? `gravacoes/${c.id}.png` : undefined,
      gravadoEm: nota.gravadoEm?.slice(0, 10) ?? c.gravadoEm,
      aluno: nota.aluno,
      regra: nota.regra
    })
  }

  for (const arquivo of candidatos) {
    const m = arquivo.match(CANDIDATO)
    const cenario = m ? porId.get(m[1]!) : undefined
    if (!m || !cenario) continue
    const nota = await lerAnotacao(`${PASTA_CANDIDATOS}/${arquivo}`)
    const png = arquivo.replace(/\.har$/, '.png')
    cenario.alunos.push({
      codigoAluno: Number(m[2]),
      papel: 'candidato',
      rota: nota.rota,
      resultado: nota.resultado,
      captura: candidatos.includes(png) ? `${PASTA_CANDIDATOS}/${png}` : undefined,
      gravadoEm: nota.gravadoEm?.slice(0, 10),
      aluno: nota.aluno,
      regra: nota.regra
    })
  }

  for (const [id, lista] of Object.entries(descartados)) {
    const cenario = porId.get(id)
    if (!cenario) continue
    for (const d of lista) cenario.alunos.push({ codigoAluno: d.codigoAluno, papel: 'descartado', descarte: d, gravadoEm: d.em.slice(0, 10) })
  }

  const avulsos: RespostaMassaE2e['avulsos'] = []
  for (const arquivo of gravacoes) {
    const m = arquivo.match(EXTRA)
    if (!m) continue
    const nota = await lerAnotacao(`gravacoes/${arquivo}`)
    const aluno: AlunoMassaE2e = { codigoAluno: Number(m[1]), papel: 'avulso', rota: nota.rota, resultado: nota.resultado, aluno: nota.aluno }
    avulsos.push({ ...aluno, arquivo: `gravacoes/${arquivo}` })
  }

  return { cenarios: [...porId.values()], avulsos }
}
