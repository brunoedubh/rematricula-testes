// Tabela de decisão do oráculo (node --test). Cada linha é uma combinação de dados e a tela que o front deve mostrar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { avaliar, avaliarHar, contextoDoHar, inconsistencias, listaDeRegras, mesmaRota, IDS_REGRAS } from './regras.mjs';

// Aluno "comum": no prazo, contrato liberado e aceito, sem pendência, com persona e endereço.
const BASE = {
  estaNoSoftLaunch: true, estaNoPeriodoAceiteContrato: true, possuiErroCadastro: false,
  indicadorE2a2: true, indicadorRadial: false,
  contratoEstaLiberado: true, contratoEstaAceito: true, codigoGrupoCursoAssociado: 120,
  possuiPendenciasFinanceiras: false,
  possuiEscolhaCoreCurriculum: false, possuiEscolhaUcExploratoria: false,
  possuiEscolhaUcPersonalizavel: false, possuiEscolhaPendenciaAcademica: false,
  telasBloqueadas: [], tiposBloqueioAcesso: [], identificadorPersona: 5,
  possuiRematriculaVigenteSemPersona: false, possuiRemanejamentoPeriodoVigente: false, possuiEndereco: true,
};

const TABELA = [
  ['nenhuma pendência', {}, {}, 'sem-pendencia', '/alteracaoResumo'],
  ['contrato a aceitar', { contratoEstaAceito: false }, {}, 'contrato', '/contrato'],
  ['contrato a aceitar sem endereço', { contratoEstaAceito: false, possuiEndereco: false }, {}, 'atualizacao-cadastral', '/atualizacaoCadastral'],
  ['certificado vence o contrato', { contratoEstaAceito: false, tiposBloqueioAcesso: [2] }, {}, 'certificado', '/envioCertificado'],
  ['certificado vence contrato sem endereço', { contratoEstaAceito: false, possuiEndereco: false, tiposBloqueioAcesso: [2] }, {}, 'certificado', '/envioCertificado'],
  ['pendência financeira (como a API manda)', { contratoEstaLiberado: false, contratoEstaAceito: false, possuiPendenciasFinanceiras: true }, {}, 'pendencia-financeira', '/pendencia/financeira'],
  ['contrato não liberado, financeiro regular', { contratoEstaLiberado: false, contratoEstaAceito: false }, {}, 'pendencia-financeira', '/pendencia/financeira'],
  ['financeiro vence escolha de UC', { contratoEstaLiberado: false, contratoEstaAceito: false, possuiPendenciasFinanceiras: true, possuiEscolhaUcPersonalizavel: true }, { disciplinaConfirmada: true }, 'pendencia-financeira', '/pendencia/financeira'],
  ['financeiro vence core e pendência acadêmica', { contratoEstaLiberado: false, contratoEstaAceito: false, possuiEscolhaCoreCurriculum: true, possuiEscolhaPendenciaAcademica: true }, { disciplinaConfirmada: false }, 'pendencia-financeira', '/pendencia/financeira'],
  ['certificado vence o financeiro', { contratoEstaLiberado: false, contratoEstaAceito: false, possuiPendenciasFinanceiras: true, tiposBloqueioAcesso: [2] }, {}, 'certificado', '/envioCertificado'],
  ['fora do soft launch, E2A', { estaNoSoftLaunch: false }, {}, 'fora-prazo', '/ForadePrazo'],
  ['fora do prazo com contrato a aceitar vai ao contrato', { estaNoSoftLaunch: false, contratoEstaAceito: false }, {}, 'fora-prazo-contrato', '/contrato'],
  ['fora do prazo sem E2A nem Radial', { estaNoSoftLaunch: false, indicadorE2a2: false, indicadorRadial: false }, {}, 'softlaunch', '/erro/rematriculaNaoIniciada'],
  ['erro de cadastro conta como fora do prazo', { possuiErroCadastro: true }, {}, 'fora-prazo', '/ForadePrazo'],
  ['sem persona com remanejamento vence fora do prazo', { identificadorPersona: null, possuiRemanejamentoPeriodoVigente: true, estaNoSoftLaunch: false }, {}, 'mudanca-academica', '/mudancaAcademica'],
  ['sem persona com rematrícula vigente', { identificadorPersona: null, possuiRematriculaVigenteSemPersona: true }, {}, 'ajustando-grade', '/ajustandoGradeHoraria'],
  ['sem persona sem vigência segue as outras regras', { identificadorPersona: null }, {}, 'sem-pendencia', '/alteracaoResumo'],
  ['Medicina com contrato aceito confirma envio', { codigoGrupoCursoAssociado: 95 }, {}, 'medicina-confirmacao-envio', '/contrato/confirmacao-envio'],
  ['Medicina com confirmação bloqueada', { codigoGrupoCursoAssociado: 95, telasBloqueadas: [1] }, {}, 'sem-pendencia', '/alteracaoResumo'],
  ['Medicina com contrato não liberado', { codigoGrupoCursoAssociado: 95, contratoEstaLiberado: false, contratoEstaAceito: false }, {}, 'medicina-assinatura-digital', '/pendencia/assinaturaDigital'],
  ['Medicina com contrato liberado não aceito não vai ao contrato', { codigoGrupoCursoAssociado: 95, contratoEstaAceito: false }, {}, 'sem-pendencia', '/alteracaoResumo'],
  // Medicina: o fluxo de contrato e financeiro é outro
  ['Medicina com pendência financeira e contrato não aceito: assinatura digital, não a tela financeira', { codigoGrupoCursoAssociado: 95, contratoEstaLiberado: false, contratoEstaAceito: false, possuiPendenciasFinanceiras: true }, {}, 'medicina-assinatura-digital', '/pendencia/assinaturaDigital'],
  ['Medicina com contrato aceito e não liberado: pendência financeira', { codigoGrupoCursoAssociado: 95, contratoEstaLiberado: false, possuiPendenciasFinanceiras: true }, {}, 'pendencia-financeira', '/pendencia/financeira'],
  ['Medicina: confirmação de envio vence o certificado', { codigoGrupoCursoAssociado: 95, tiposBloqueioAcesso: [2] }, {}, 'medicina-confirmacao-envio', '/contrato/confirmacao-envio'],
  ['Medicina com envio já confirmado: certificado', { codigoGrupoCursoAssociado: 95, telasBloqueadas: [1], tiposBloqueioAcesso: [2] }, {}, 'certificado', '/envioCertificado'],
  ['Medicina não tem pré-visualização da grade', { codigoGrupoCursoAssociado: 95, telasBloqueadas: [1], possuiEscolhaUcPersonalizavel: true }, { disciplinaConfirmada: true }, 'uc-personalizavel', '/UcPersonalizavel'],
  ['Medicina fora do prazo com contrato a aceitar: fora do prazo, não o contrato', { codigoGrupoCursoAssociado: 95, contratoEstaAceito: false, estaNoSoftLaunch: false }, {}, 'fora-prazo', '/ForadePrazo'],
  ['escolha de UC com disciplina confirmada', { possuiEscolhaUcPersonalizavel: true }, { disciplinaConfirmada: true }, 'pre-visualizacao-grade', '/preVisualizacaoGrade'],
  ['escolha de UC sem disciplina confirmada', { possuiEscolhaUcPersonalizavel: true }, { disciplinaConfirmada: false }, 'uc-personalizavel', '/UcPersonalizavel'],
  ['core sem disciplina confirmada', { possuiEscolhaCoreCurriculum: true }, { disciplinaConfirmada: false }, 'core-curriculum', '/CoreCurriculum'],
  ['UC exploratória vence core', { possuiEscolhaCoreCurriculum: true, possuiEscolhaUcExploratoria: true }, { disciplinaConfirmada: false }, 'uc-exploratoria', '/UcExploratoria'],
  ['pré-visualização bloqueada', { possuiEscolhaCoreCurriculum: true, telasBloqueadas: [5] }, { disciplinaConfirmada: true }, 'core-curriculum', '/CoreCurriculum'],
  ['pendência acadêmica', { possuiEscolhaPendenciaAcademica: true }, { disciplinaConfirmada: false }, 'pendencia-academica', '/pendenciasAcademica'],
  ['erro da API', null, { erroApi: true }, 'erro-api', '/erro/erroDeSistema'],
];

for (const [nome, ajuste, ctx, regra, rota] of TABELA) {
  test(`regra: ${nome}`, () => {
    const r = avaliar(ajuste === null ? null : { ...BASE, ...ajuste }, ctx);
    assert.equal(r.regra.id, regra);
    assert.equal(r.rota, rota);
    assert.equal(r.aplicaveis[0].id, regra, 'a primeira aplicável é a que decide');
  });
}

test('lista as regras que perderam pela prioridade', () => {
  const r = avaliar({ ...BASE, contratoEstaLiberado: false, contratoEstaAceito: false, tiposBloqueioAcesso: [2], possuiPendenciasFinanceiras: true, possuiEscolhaUcPersonalizavel: true }, { disciplinaConfirmada: false });
  assert.deepEqual(r.aplicaveis.map(x => x.id), ['certificado', 'pendencia-financeira', 'uc-personalizavel']);
  assert.equal(r.campos.possuiPendenciasFinanceiras, true);
  assert.deepEqual(r.avisos, []);
});

test('acusa dado impossível: pendência financeira com contrato liberado', () => {
  const r = avaliar({ ...BASE, contratoEstaAceito: false, possuiPendenciasFinanceiras: true });
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /Dado impossível/);
});

test('combinações não montam dado que a API nunca devolve', () => {
  const { combinacoes } = JSON.parse(fs.readFileSync(new URL('../cenarios/combinacoes.json', import.meta.url), 'utf8'));
  for (const c of combinacoes) {
    // Sem a gravação base aqui: confere o ajuste sobre o aluno "comum" (contrato liberado).
    assert.deepEqual(inconsistencias({ ...BASE, ...c.ajuste }), [], c.id);
    assert.ok(IDS_REGRAS.has(c.regra), `${c.id}: regra ${c.regra} não existe`);
  }
});

test('avisa quando falta o dado das disciplinas', () => {
  const r = avaliar({ ...BASE, possuiEscolhaCoreCurriculum: true }, {});
  assert.equal(r.regra.id, 'core-curriculum');
  assert.equal(r.avisos.length, 1);
});

test('todas as regras têm id único e aparecem na lista', () => {
  const lista = listaDeRegras();
  assert.equal(new Set(lista.map(r => r.id)).size, lista.length);
  assert.equal(lista.length, IDS_REGRAS.size);
});

test('mesmaRota ignora maiúsculas, query e barra final', () => {
  assert.ok(mesmaRota('/alteracaoResumo/', '/alteracaoresumo?x=1'));
  assert.ok(!mesmaRota('/contrato', '/contrato/confirmacao-envio'));
});

test('contexto do HAR: erro, ajuste e disciplinas', () => {
  const har = { log: { entries: [
    { request: { url: 'https://x/rematricula/services/api/v1/ObterInformacoesAluno?codigoAluno=1' }, response: { status: 200, content: { text: JSON.stringify(BASE) } } },
    { request: { url: 'https://x/rematricula/services/api/v1/disciplinasDisponiveis/alunos/1/alteracao-resumo?codigoPeriodoLetivo=1' }, response: { status: 200, content: { text: '[{"situacao":1},{"situacao":5}]' } } },
  ] } };
  const ctx = contextoDoHar(har, { possuiEscolhaCoreCurriculum: true });
  assert.equal(ctx.erroApi, false);
  assert.equal(ctx.disciplinaConfirmada, true);
  assert.equal(avaliarHar(har, { possuiEscolhaCoreCurriculum: true }).regra.id, 'pre-visualizacao-grade');
  assert.equal(avaliarHar({ log: { entries: [{ request: { url: 'https://x/services/ObterInformacoesAluno' }, response: { status: 500 } }] } }).regra.id, 'erro-api');
});

// Gravações locais (fora do git): o oráculo concorda com a tela que a gravação viu nos cenários conferidos.
const catalogo = JSON.parse(fs.readFileSync(new URL('../cenarios/catalogo.json', import.meta.url), 'utf8'));
for (const c of catalogo.cenarios.filter(x => x.status === 'gravado' && x.regra)) {
  const arquivo = new URL(`../gravacoes/${c.id}.har`, import.meta.url);
  test(`gravação ${c.id} cai na regra declarada`, { skip: !fs.existsSync(arquivo) && 'sem gravação local' }, () => {
    const r = avaliarHar(JSON.parse(fs.readFileSync(arquivo, 'utf8')));
    assert.ok([].concat(c.regra).includes(r.regra.id), `regra do aluno: ${r.regra.id}`);
  });
}
