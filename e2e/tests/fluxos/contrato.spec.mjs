// Fluxo com escrita: aceite do contrato (PLANO.md 5.1 / etapa 6), sobre a gravação "contrato-a-aceitar".
//
// Front (Vue 2): Contrato.vue → AssinarContrato.vue → ContratoService.ArmazenarAceiteAluno
//   POST contrato/api/v1/contratos/alunos/{aluno}/periodos-letivos/{periodo}  corpo { numeroMatricula }
//   depois: limpa o aluno da store e vai para /contrato/aceito.
// Resposta real (servico-rematricula-contrato, ContratoController.cs): 201 Created com o texto
//   "Aceite de contrato cadastrado com sucesso!" (o front ignora o corpo).
import { expect } from '@playwright/test';
import { fluxo, responder, respostaGravada } from '../fluxos.mjs';
import { aplicarAvancos } from '../../scripts/avancos.mjs';

const CENARIO = 'contrato-a-aceitar';
const ACEITE = /^contrato\/api\/v1\/contratos\/alunos\/\d+\/periodos-letivos\/\d+$/;
const INFORMACOES = /ObterInformacoesAluno/i;

async function aceitar({ page, info, abrir }, resposta) {
  const mobile = Boolean(info.project.use.isMobile);
  const reprodutor = await abrir();
  const aceite = await responder(page, 'POST', ACEITE, () => {
    // Estado depois da ação: com sucesso, o aluno volta com o contrato aceito (mesma regra do avanço "contrato").
    // Com erro, o backend não mudou nada e o ObterInformacoesAluno continua como gravado.
    if (resposta.status < 400) {
      reprodutor.ajustar((k, corpo) => {
        if (INFORMACOES.test(k)) aplicarAvancos(corpo, ['contrato']);
        return corpo;
      });
    }
    return resposta;
  });

  await expect(page).toHaveURL(/\/contrato$/);
  const botao = page.getByRole('button', { name: 'Aceitar contrato' });
  const liConcordo = page.getByText('Li e concordo com os termos do contrato');
  await expect(botao).toBeDisabled();
  await liConcordo.click();
  if (mobile) {
    // No celular (Contrato.vue → onChangeCheckbox), marcar sem ter aberto o PDF abre o aviso
    // "Você precisa visualizar o contrato". Visualizar baixa o PDF (gravado) e desmarca a caixa: marca de novo.
    const aviso = page.getByRole('dialog').filter({ hasText: 'visualizar o contrato' });
    await expect(aviso).toBeVisible();
    await aviso.getByRole('button', { name: 'Visualizar contrato' }).click();
    await expect(aviso).toBeHidden();
    await liConcordo.click();
  }
  await expect(botao).toBeEnabled();
  await botao.click();
  return { aceite, reprodutor };
}

fluxo(CENARIO, 'aceite', 'Aceite do contrato', { rota: '/contrato/aceito' }, async ctx => {
  const { page } = ctx;
  const aluno = respostaGravada(CENARIO, INFORMACOES);
  const { aceite } = await aceitar(ctx, { status: 201, json: 'Aceite de contrato cadastrado com sucesso!' });

  await expect(page).toHaveURL(/\/contrato\/aceito$/);
  await expect(page.getByText('Seu contrato foi aceito')).toBeVisible();
  expect(aceite.chamadas).toHaveLength(1);
  expect(aceite.chamadas[0].chave).toBe(`POST contrato/api/v1/contratos/alunos/${aluno.codigoAluno}/periodos-letivos/${aluno.codigoPeriodoLetivo}`);
  expect(aceite.chamadas[0].corpo).toEqual({ numeroMatricula: aluno.numeroMatricula });
});

// Comportamento ATUAL do Vue 2, registrado como está: AssinarContrato.vue engole o erro do POST
// (tentarAssinarContrato devolve false) e segue para /contrato/aceito do mesmo jeito.
// Se o Vue 3 corrigir (ficar no contrato ou mostrar erro), este teste muda junto, com aval do PO.
fluxo(CENARIO, 'aceite-com-erro', 'Aceite do contrato com erro da API (comportamento atual)', { rota: '/contrato/aceito' }, async ctx => {
  const { page } = ctx;
  const { aceite } = await aceitar(ctx, { status: 500, json: { mensagem: 'erro simulado pelo teste' } });

  await expect(page).toHaveURL(/\/contrato\/aceito$/);
  await expect(page.getByText('Seu contrato foi aceito')).toBeVisible();
  expect(aceite.chamadas).toHaveLength(1);
});
