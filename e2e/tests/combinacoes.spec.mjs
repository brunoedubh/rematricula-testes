// Combinações de regras (cenarios/combinacoes.json, PLANO.md 3.5).
// Reaproveita a gravação de um cenário e ajusta o ObterInformacoesAluno para o aluno ter duas ou mais
// condições ao mesmo tempo. Confere que o front escolhe a tela pela prioridade das regras.
import { test } from './gif.mjs';
import fs from 'node:fs';
import { abrirComGravacao } from './apoio.mjs';
import { regraDaGravacao, verificarTela } from './verificacao.mjs';

const ARQUIVO = 'cenarios/combinacoes.json';
const combinacoes = fs.existsSync(ARQUIVO) ? JSON.parse(fs.readFileSync(ARQUIVO, 'utf8')).combinacoes : [];
// E2E_CENARIOS filtra pelo id da combinação ou pelo da gravação base.
const filtro = process.env.E2E_CENARIOS ? new Set(process.env.E2E_CENARIOS.split(',')) : null;

for (const c of combinacoes.filter(c => !filtro || filtro.has(c.id) || filtro.has(c.base))) {
  test(`${c.titulo} [${c.id}]`, async ({ page, baseURL }, info) => {
    test.skip(!fs.existsSync(`gravacoes/${c.base}.har`), `sem a gravação base (${c.base}) nesta máquina`);
    info.annotations.push({ type: 'tipo', description: 'combinacao' });
    info.annotations.push({ type: 'base', description: c.base });
    info.annotations.push({ type: 'ajuste', description: JSON.stringify(c.ajuste) });
    const oraculo = regraDaGravacao(c.base, c.ajuste);
    const reprodutor = await abrirComGravacao(page, c.base, undefined, baseURL, { ajusteInformacoes: c.ajuste });
    await verificarTela({ page, baseURL, info, cenario: c, oraculo, reprodutor });
  });
}
