// node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificar, rotaDaUrl } from './classificar.mjs';

const base = 'https://cloudapp-hml.animaeducacao.com.br/rematricula';

test('rota da URL sem o prefixo', () => {
  assert.equal(rotaDaUrl(`${base}/pendencia/financeira`), 'pendencia/financeira');
  assert.equal(rotaDaUrl(`${base}/`), '');
});

test('confere quando a rota bate com a esperada (sem diferenciar maiúsculas)', () => {
  assert.deepEqual(classificar({ esperado: 'alteracaoresumo', url: `${base}/alteracaoResumo` }), { resultado: 'confere', rota: 'alteracaoResumo' });
});

test('regex com fim de linha não confunde /contrato com /contrato/confirmacao-envio', () => {
  assert.equal(classificar({ esperado: '/contrato$', url: `${base}/contrato` }).resultado, 'confere');
  assert.equal(classificar({ esperado: '/contrato$', url: `${base}/contrato/confirmacao-envio` }).resultado, 'outra-tela');
});

test('tela de erro pode ser o próprio cenário', () => {
  assert.equal(classificar({ esperado: 'erroDeSistema', url: `${base}/erro/erroDeSistema` }).resultado, 'confere');
});

test('não abriu: ficou na autorização ou caiu em erro genérico', () => {
  assert.equal(classificar({ esperado: 'pendencia/financeira', url: `${base}/autorizacao-idp/token/a/b/1` }).resultado, 'nao-abriu');
  assert.equal(classificar({ esperado: 'pendencia/financeira', url: `${base}/erro/erroDeSistema` }).resultado, 'nao-abriu');
});

test('outra tela quando abriu mas não é a esperada', () => {
  assert.deepEqual(classificar({ esperado: 'pendencia/financeira', url: `${base}/alteracaoResumo` }), { resultado: 'outra-tela', rota: 'alteracaoResumo' });
});

test('sem esperado: abriu, mas alguém precisa confirmar a tela', () => {
  assert.equal(classificar({ esperado: null, url: `${base}/jornada` }).resultado, 'sem-esperado');
  assert.equal(classificar({ esperado: null, url: `${base}/autorizacao-idp/token/a/b/1` }).resultado, 'nao-abriu');
});

test('fora do período não é aceito como tela de cenário sem esperado', () => {
  assert.equal(classificar({ esperado: null, url: `${base}/erro/rematriculaNaoIniciada` }).resultado, 'fora-do-periodo');
  assert.equal(classificar({ esperado: 'contrato', url: `${base}/erro/rematriculaNaoIniciada` }).resultado, 'fora-do-periodo');
  assert.equal(classificar({ esperado: null, url: `${base}/ForadePrazo` }).resultado, 'fora-do-periodo');
});

test('fora do período ainda confere quando é a tela esperada do cenário', () => {
  assert.equal(classificar({ esperado: 'ForadePrazo', url: `${base}/ForadePrazo` }).resultado, 'confere');
  assert.equal(classificar({ esperado: 'erro/rematriculaSoftlaunch', url: `${base}/erro/rematriculaSoftlaunch` }).resultado, 'confere');
});
