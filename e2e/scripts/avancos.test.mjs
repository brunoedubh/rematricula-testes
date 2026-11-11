import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancosPara, aplicarAvancos } from './avancos.mjs';

const aluno = (extra = {}) => ({
  tiposBloqueioAcesso: [2],
  estaNoPeriodoAceiteContrato: true,
  contratoEstaLiberado: true,
  contratoEstaAceito: false,
  codigoGrupoCursoAssociado: 264,
  ...extra,
});

test('auto: cenário comum pula certificado e contrato', () => {
  assert.deepEqual(avancosPara('UcPersonalizavel'), ['certificado', 'contrato']);
  assert.deepEqual(avancosPara(null), ['certificado', 'contrato']);
});

test('auto: cenário do contrato não pula o contrato, mas pula o certificado', () => {
  assert.deepEqual(avancosPara('/contrato$'), ['certificado']);
});

test('auto: cenário do certificado não pula o certificado', () => {
  assert.deepEqual(avancosPara('envioCertificado'), ['contrato']);
});

test('nao e lista explícita', () => {
  assert.deepEqual(avancosPara('x', 'nao'), []);
  assert.deepEqual(avancosPara('x', 'contrato'), ['contrato']);
  assert.throws(() => avancosPara('x', 'financeiro'), /desconhecido/);
});

test('aplica só o que trava e informa o que mudou', () => {
  const a = aluno();
  assert.deepEqual(aplicarAvancos(a, ['certificado', 'contrato']), ['certificado', 'contrato']);
  assert.deepEqual(a.tiposBloqueioAcesso, []);
  assert.equal(a.contratoEstaAceito, true);
  // Segunda vez: nada a mudar
  assert.deepEqual(aplicarAvancos(a, ['certificado', 'contrato']), []);
});

test('contrato: medicina e fora do período de aceite não são alterados', () => {
  assert.deepEqual(aplicarAvancos(aluno({ codigoGrupoCursoAssociado: 95 }), ['contrato']), []);
  assert.deepEqual(aplicarAvancos(aluno({ estaNoPeriodoAceiteContrato: false }), ['contrato']), []);
  assert.deepEqual(aplicarAvancos(aluno({ contratoEstaLiberado: false }), ['contrato']), []);
});
