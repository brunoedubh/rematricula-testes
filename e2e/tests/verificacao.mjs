// Verificação de um cenário contra a REGRA, e não só contra a gravação (PLANO.md 3.5).
//
// Cada conferência vira um item em "verificacoes" (anotação lida pelo scripts/resumo.mjs), com o que se
// esperava, o que se obteve e se passou. A aba Execução mostra a lista: "passou" deixa de ser uma caixa-preta.
//
// Ordem:
//   1. massa     o dado gravado (ObterInformacoesAluno) cai na regra que o cenário declara?
//                Se não, o aluno não serve para o cenário: o resultado é "massa inválida", não "front errado".
//   2. catalogo  o esperado do catálogo concorda com a tela que a regra manda?
//   3. regra     o front parou na tela que a regra manda?
//   4. rota, textos, botões, desabilitados, naoDeve: o que o catálogo pede na tela.
//   5. api       chamadas que a gravação não tem (ressalva: não reprova).
import fs from 'node:fs';
import { test, expect } from './gif.mjs';
import { rotaRelativa } from './apoio.mjs';
import { avaliarHar, mesmaRota, regrasDeclaradas } from '../regras/regras.mjs';

const primeiraLinha = e => String(e?.message ?? e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').find(l => l.trim())?.trim() ?? 'falhou';
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Avalia a regra pela gravação (com o ajuste da combinação, se houver). */
export function regraDaGravacao(idGravacao, ajuste) {
  const har = JSON.parse(fs.readFileSync(`gravacoes/${idGravacao}.har`, 'utf8'));
  return avaliarHar(har, ajuste);
}

/**
 * Confere a tela aberta.
 * @param {{ page, baseURL, info, cenario: { regra?, esperado? }, oraculo, reprodutor }} p
 */
export async function verificarTela({ page, baseURL, info, cenario, oraculo, reprodutor }) {
  const lista = [];
  const rotaAtual = () => rotaRelativa(page.url(), baseURL);

  async function checar(tipo, descricao, fn, extra = {}) {
    try {
      await test.step(descricao, fn);
      lista.push({ tipo, descricao, ok: true, ...extra });
    } catch (e) {
      lista.push({ tipo, descricao, ok: false, erro: primeiraLinha(e), ...extra });
    }
  }

  const declaradas = regrasDeclaradas(cenario.regra);
  const esperado = cenario.esperado ?? {};

  // 1. Massa: o aluno (ou o dado montado) é mesmo do cenário?
  if (declaradas.length) {
    const ok = declaradas.includes(oraculo.regra.id);
    lista.push({
      tipo: 'massa',
      descricao: `O dado do aluno cai na regra do cenário (${declaradas.join(' ou ')})`,
      ok,
      esperado: declaradas.join(' | '),
      obtido: oraculo.regra.id,
      erro: ok ? undefined : `O aluno gravado cai na regra "${oraculo.regra.titulo}" (tela ${oraculo.rota}), não na do cenário`,
    });
    if (!ok) info.annotations.push({ type: 'massa-invalida', description: oraculo.regra.id });
  }

  // 2. O catálogo concorda com a regra? (pega esperado copiado da gravação quando ela estava errada)
  if (esperado.rota) {
    let ok = false;
    try { ok = new RegExp(esperado.rota, 'i').test(oraculo.rota); } catch { ok = false; }
    lista.push({
      tipo: 'catalogo',
      descricao: 'A tela esperada no catálogo é a que a regra manda',
      ok,
      esperado: esperado.rota,
      obtido: oraculo.rota,
      erro: ok ? undefined : `O catálogo espera "${esperado.rota}", mas a regra "${oraculo.regra.titulo}" manda para ${oraculo.rota}`,
    });
  }

  // 3. O front seguiu a regra? (espera a navegação assentar até a tela da regra)
  await checar('regra', `Front para na tela da regra "${oraculo.regra.titulo}"`, async () => {
    await expect.poll(rotaAtual, { message: 'tela obtida', timeout: 10_000 }).toMatch(new RegExp(`^${escapar(oraculo.rota)}/?(?:[?#].*)?$`, 'i'));
  }, { esperado: oraculo.rota });
  const ultima = lista[lista.length - 1];
  ultima.obtido = rotaAtual();
  ultima.ok = ultima.ok && mesmaRota(ultima.obtido, oraculo.rota);

  // 4. O que o catálogo pede na tela.
  if (esperado.rota) {
    await checar('rota', `Tela esperada no catálogo: ${esperado.rota}`, async () => {
      await expect.poll(rotaAtual, { timeout: 5_000 }).toMatch(new RegExp(esperado.rota, 'i'));
    }, { esperado: esperado.rota });
    lista[lista.length - 1].obtido = rotaAtual();
  }
  for (const t of esperado.textos ?? []) {
    await checar('texto', `Mostra o texto "${t}"`, () => expect(page.getByText(t).first()).toBeVisible());
  }
  for (const b of esperado.botoes ?? []) {
    await checar('botao', `Mostra o botão "${b}"`, () => expect(page.getByRole('button', { name: b }).first()).toBeVisible());
  }
  for (const b of esperado.desabilitados ?? []) {
    await checar('desabilitado', `O botão "${b}" começa desabilitado`, () => expect(page.getByRole('button', { name: b }).first()).toBeDisabled());
  }
  for (const t of esperado.naoDeve?.textos ?? []) {
    await checar('nao-deve', `Não mostra o texto "${t}"`, () => expect(page.getByText(t).first()).toBeHidden());
  }
  for (const b of esperado.naoDeve?.botoes ?? []) {
    await checar('nao-deve', `Não mostra o botão "${b}"`, () => expect(page.getByRole('button', { name: b }).first()).toBeHidden());
  }

  // 5. Saúde da reprodução: chamada sem gravação é ressalva (não reprova), mas aparece.
  const semGravacao = [...new Set(reprodutor?.semGravacao ?? [])];
  if (semGravacao.length) {
    lista.push({
      tipo: 'api',
      descricao: `${semGravacao.length} chamada(s) de API sem resposta gravada`,
      ok: false,
      ressalva: true,
      obtido: semGravacao.join(', '),
      erro: 'O front pediu algo que a gravação não tem (a chamada foi abortada). A tela pode estar incompleta.',
    });
  }

  info.annotations.push({ type: 'rota-esperada', description: esperado.rota ?? oraculo.rota });
  info.annotations.push({ type: 'rota-regra', description: oraculo.rota });
  info.annotations.push({ type: 'rota-obtida', description: rotaAtual() });
  info.annotations.push({ type: 'regra', description: JSON.stringify({ declarada: declaradas, ...oraculo }) });
  info.annotations.push({ type: 'verificacoes', description: JSON.stringify(lista) });
  for (const k of semGravacao) info.annotations.push({ type: 'sem-gravacao', description: k });

  const falhas = lista.filter(v => !v.ok && !v.ressalva);
  if (falhas.length) {
    throw new Error(`${falhas.length} verificação(ões) falharam:\n${falhas.map(f => `- [${f.tipo}] ${f.descricao}: ${f.erro ?? ''}`).join('\n')}`);
  }
}
