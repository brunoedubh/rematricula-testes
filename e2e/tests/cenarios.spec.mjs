// Um teste por cenário "gravado" do catálogo. Incluir cenário = editar cenarios/catalogo.json.
// O teste confere a tela contra a REGRA (regras/regras.mjs) e contra o catálogo: ver tests/verificacao.mjs.
import { test } from './gif.mjs';
import fs from 'node:fs';
import { abrirComGravacao } from './apoio.mjs';
import { regraDaGravacao, verificarTela } from './verificacao.mjs';

const catalogo = JSON.parse(fs.readFileSync('cenarios/catalogo.json', 'utf8'));
// Opcional: o código do aluno sai da própria gravação quando não há alunos.local.json (pipeline).
const alunos = fs.existsSync('cenarios/alunos.local.json') ? JSON.parse(fs.readFileSync('cenarios/alunos.local.json', 'utf8')) : {};
// Opcional: E2E_CENARIOS=id1,id2 roda só esses cenários (aba Execução, "só os que falharam").
const filtro = process.env.E2E_CENARIOS ? new Set(process.env.E2E_CENARIOS.split(',')) : null;

for (const c of catalogo.cenarios.filter(c => c.status === 'gravado' && (!filtro || filtro.has(c.id)))) {
  test(`${c.titulo} [${c.id}]`, async ({ page, baseURL }, info) => {
    test.skip(!fs.existsSync(`gravacoes/${c.id}.har`), 'sem gravação local; rode o gravador');
    info.annotations.push({ type: 'tipo', description: 'cenario' });
    const oraculo = regraDaGravacao(c.id);
    const reprodutor = await abrirComGravacao(page, c.id, alunos[c.id], baseURL);
    await verificarTela({ page, baseURL, info, cenario: c, oraculo, reprodutor });
  });
}
