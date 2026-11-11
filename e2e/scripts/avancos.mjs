// Avanços: telas que travam a jornada antes da tela do cenário (PLANO.md 3.3.1).
//
// Pela ordem do GerenciadorRotasPrioritarias do front, o envio do certificado e o aceite do contrato
// vêm antes de quase todas as telas. Para sair delas o aluno precisa GRAVAR algo (enviar o documento,
// aceitar o contrato), e o gravador é só leitura. Então, durante a gravação, a resposta de
// ObterInformacoesAluno é ajustada como ficaria depois dessa ação. É o mesmo que o próprio front faz
// depois do envio do certificado (EnvioCertificado.vue → onDocumentoEnviado tira o bloqueio da store).
// O front segue para a próxima tela e chama as APIs reais dela. Nada é gravado no HML.
//
// O HAR guarda a resposta já ajustada, então a reprodução vê o mesmo que a gravação viu.

const BLOQUEIO_CONTRATO = 1; // ETiposBloqueioAcesso.ContratoPendente
const BLOQUEIO_CERTIFICADO = 2; // ETiposBloqueioAcesso.CertificadoConclusaoEnsinoMedioPendente
const GRUPO_MEDICINA = 95; // Curso.CodigoGrupoCursoMedicina

export const AVANCOS = [
  {
    id: 'certificado',
    rota: '/envioCertificado',
    descricao: 'certificado do ensino médio tratado como enviado',
    aplicar(a) {
      if (!Array.isArray(a.tiposBloqueioAcesso) || !a.tiposBloqueioAcesso.includes(BLOQUEIO_CERTIFICADO)) return false;
      a.tiposBloqueioAcesso = a.tiposBloqueioAcesso.filter(t => t !== BLOQUEIO_CERTIFICADO);
      return true;
    },
  },
  {
    id: 'contrato',
    rota: '/contrato',
    descricao: 'contrato tratado como aceito',
    // Mesma condição do "precisaContrato" do front. Medicina tem fluxo próprio (assinatura digital) e fica de fora.
    aplicar(a) {
      const trava = a.estaNoPeriodoAceiteContrato && a.contratoEstaLiberado && !a.contratoEstaAceito
        && a.codigoGrupoCursoAssociado !== GRUPO_MEDICINA;
      if (!trava) return false;
      a.contratoEstaAceito = true;
      if (Array.isArray(a.tiposBloqueioAcesso)) a.tiposBloqueioAcesso = a.tiposBloqueioAcesso.filter(t => t !== BLOQUEIO_CONTRATO);
      return true;
    },
  },
];

const IDS = new Set(AVANCOS.map(a => a.id));

/**
 * Quais avanços usar.
 * - opcao "nao": nenhum.
 * - opcao "certificado,contrato": exatamente esses.
 * - opcao "auto" (padrão): todos, menos os que levam à própria tela do cenário (o esperado casa com a rota do avanço).
 *   Ex.: o cenário do contrato não pula o contrato, mas pula o certificado.
 */
export function avancosPara(esperado, opcao = 'auto') {
  if (opcao === 'nao') return [];
  if (opcao && opcao !== 'auto') {
    const ids = opcao.split(',').map(s => s.trim()).filter(Boolean);
    const desconhecido = ids.find(id => !IDS.has(id));
    if (desconhecido) throw new Error(`Avanço desconhecido: ${desconhecido} (use ${[...IDS].join(', ')}, auto ou nao)`);
    return ids;
  }
  let re = null;
  if (esperado) {
    try { re = new RegExp(esperado, 'i'); } catch { re = null; }
  }
  return AVANCOS.filter(a => !re || !re.test(a.rota)).map(a => a.id);
}

/** Aplica os avanços no corpo de ObterInformacoesAluno (altera o objeto). Devolve os ids que mudaram algo. */
export function aplicarAvancos(informacoes, ids) {
  if (!informacoes || typeof informacoes !== 'object') return [];
  return AVANCOS.filter(a => ids.includes(a.id) && a.aplicar(informacoes)).map(a => a.id);
}

export const ENDPOINT_INFORMACOES = /\/services\/.*ObterInformacoesAluno/i;
