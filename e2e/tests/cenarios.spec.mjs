// Um teste por cenário "gravado" do catálogo. Incluir cenário = editar cenarios/catalogo.json.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { abrirComGravacao, rotaRelativa } from './apoio.mjs';

const catalogo = JSON.parse(fs.readFileSync('cenarios/catalogo.json', 'utf8'));
// Opcional: o código do aluno sai da própria gravação quando não há alunos.local.json (pipeline).
const alunos = fs.existsSync('cenarios/alunos.local.json') ? JSON.parse(fs.readFileSync('cenarios/alunos.local.json', 'utf8')) : {};
// Opcional: E2E_CENARIOS=id1,id2 roda só esses cenários (aba Execução, "só os que falharam").
const filtro = process.env.E2E_CENARIOS ? new Set(process.env.E2E_CENARIOS.split(',')) : null;

for (const c of catalogo.cenarios.filter(c => c.status === 'gravado' && (!filtro || filtro.has(c.id)))) {
  test(`${c.titulo} [${c.id}]`, async ({ page, baseURL }, info) => {
    test.skip(!fs.existsSync(`gravacoes/${c.id}.har`), 'sem gravação local; rode o gravador');
    info.annotations.push({ type: 'rota-esperada', description: c.esperado.rota });
    const { semGravacao } = await abrirComGravacao(page, c.id, alunos[c.id], baseURL);
    try {
      await expect(page).toHaveURL(new RegExp(c.esperado.rota, 'i'));
      for (const t of c.esperado.textos ?? []) await expect(page.getByText(t).first()).toBeVisible();
      for (const b of c.esperado.botoes ?? []) await expect(page.getByRole('button', { name: b })).toBeVisible();
    } finally {
      // Tela onde o app parou, relativa ao ALVO (para comparar com a esperada na aba Execução).
      info.annotations.push({ type: 'rota-obtida', description: rotaRelativa(page.url(), baseURL) });
      // Chamada que o front fez e a gravação não tem: no Vue 3, sinal de contrato de API diferente.
      for (const k of new Set(semGravacao)) info.annotations.push({ type: 'sem-gravacao', description: k });
    }
  });
}
