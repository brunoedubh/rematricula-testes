// Resumo do aluno como o HML o vê (resposta de ObterInformacoesAluno), SEM dados pessoais.
// Serve para a "massa de teste" (quem é cada aluno, em que período, se o soft launch valeu)
// e para a esteira entender por que um candidato caiu em "fora do período".

/** Só campos acadêmicos: nada de nome, CPF, e-mail, telefone ou matrícula. */
export function resumoAluno(info) {
  if (!info || typeof info !== 'object') return null;
  return {
    codigoAluno: info.codigoAluno ?? null,
    periodoLetivo: info.periodoLetivo ?? null,
    codigoPeriodoLetivo: info.codigoPeriodoLetivo ?? null,
    curso: info.curso ?? null,
    codigoCurso: info.codigoCurso ?? null,
    instituicao: info.siglaInstituicao ?? info.instituicao ?? null,
    campus: info.campus ?? null,
    persona: info.identificadorPersona ?? null,
    estaNoSoftLaunch: info.estaNoSoftLaunch ?? null,
    pendenciaFinanceira: info.possuiPendenciasFinanceiras ?? null,
    contratoLiberado: info.contratoEstaLiberado ?? null,
    contratoAceito: info.contratoEstaAceito ?? null,
    bloqueios: Array.isArray(info.tiposBloqueioAcesso) ? info.tiposBloqueioAcesso : [],
  };
}

/** Primeira resposta 200 de ObterInformacoesAluno no HAR → resumo (ou null). */
export function resumoDoHar(har) {
  const entrada = har?.log?.entries?.find(e => /ObterInformacoesAluno/i.test(e.request?.url ?? '') && e.response?.status === 200);
  if (!entrada) return null;
  try {
    return resumoAluno(JSON.parse(entrada.response.content?.text ?? ''));
  } catch {
    return null;
  }
}
