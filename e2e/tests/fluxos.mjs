// Fluxos com escrita (PLANO.md 5.1 / etapa 6).
//
// A gravação é só leitura: ela leva o front até a tela da ação. A resposta da ação (POST/PUT/PATCH/DELETE)
// é montada aqui, no formato real (tirado do controller do backend ou de uma captura com aluno de teste),
// e o teste confere o que o front faz com ela. Nada sai para fora: o que não está gravado nem respondido
// aqui é abortado pelo reprodutor.
import { test } from '@playwright/test';
import fs from 'node:fs';
import { abrirComGravacao, chave, corsDe, rotaRelativa } from './apoio.mjs';

const MARCA = '/services/';

/**
 * Responde a uma ação do front. Registrado depois do reprodutor, tem prioridade sobre a gravação.
 * - metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
 * - caminho: RegExp casada contra o caminho depois de /services/ (ex.: /^contrato\/api\/v1\/contratos\/alunos\/\d+\/periodos-letivos\/\d+$/)
 * - resposta: { status, json?, body? } ou função (req) => resposta
 * Devolve { chamadas }: cada chamada com { chave, corpo, headers }, para o teste conferir o que o front enviou.
 */
export async function responder(page, metodo, caminho, resposta) {
  const chamadas = [];
  await page.route(u => u.pathname.includes(MARCA), async route => {
    const req = route.request();
    if (req.method() !== metodo.toUpperCase()) return route.fallback();
    const k = chave(req.method(), req.url());
    const semMetodo = k.slice(k.indexOf(' ') + 1).split('?')[0];
    if (!caminho.test(semMetodo)) return route.fallback();

    let corpo = req.postData();
    try { corpo = corpo ? JSON.parse(corpo) : corpo; } catch { /* corpo não JSON fica como texto */ }
    chamadas.push({ chave: k, corpo, headers: req.headers() });

    const r = typeof resposta === 'function' ? await resposta(req) : resposta;
    const temJson = r.json !== undefined;
    return route.fulfill({
      status: r.status ?? 200,
      headers: { ...(temJson ? { 'content-type': 'application/json; charset=utf-8' } : {}), ...corsDe(req) },
      body: temJson ? JSON.stringify(r.json) : (r.body ?? ''),
    });
  });
  return { chamadas };
}

/** Corpo gravado de uma chamada GET do cenário (ex.: ObterInformacoesAluno), para montar respostas coerentes. */
export function respostaGravada(idCenario, padrao) {
  const har = JSON.parse(fs.readFileSync(`gravacoes/${idCenario}.har`, 'utf8'));
  const e = har.log.entries.find(x => padrao.test(x.request.url));
  return e ? JSON.parse(e.response.content.text) : undefined;
}

/**
 * Declara um fluxo sobre um cenário gravado.
 * - `rota`: tela esperada depois da ação (anotação da aba Execução, como nos cenários).
 * - O título leva o id "<cenario>--<fluxo>", que o resumo da execução usa como cenário.
 * - E2E_CENARIOS filtra pelo id do fluxo ou pelo do cenário de origem.
 * - corpo recebe { page, baseURL, info, abrir }.
 */
export function fluxo(cenario, id, titulo, { rota }, corpo) {
  const idFluxo = `${cenario}--${id}`;
  const filtro = process.env.E2E_CENARIOS ? new Set(process.env.E2E_CENARIOS.split(',')) : null;
  if (filtro && !filtro.has(cenario) && !filtro.has(idFluxo)) return;
  test(`${titulo} [${idFluxo}]`, async ({ page, baseURL }, info) => {
    test.skip(!fs.existsSync(`gravacoes/${cenario}.har`), 'sem gravação local; rode o gravador');
    info.annotations.push({ type: 'rota-esperada', description: rota });
    // abrir(): abre o front com a gravação do cenário. Devolve o reprodutor ({ semGravacao, ajustar }).
    let reprodutor;
    const abrir = async codigo => (reprodutor = await abrirComGravacao(page, cenario, codigo, baseURL));
    try {
      await corpo({ page, baseURL, info, abrir });
    } finally {
      info.annotations.push({ type: 'rota-obtida', description: rotaRelativa(page.url(), baseURL) });
      for (const k of new Set(reprodutor?.semGravacao ?? [])) info.annotations.push({ type: 'sem-gravacao', description: k });
    }
  });
}
