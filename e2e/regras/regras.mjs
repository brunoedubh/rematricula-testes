// Oráculo das regras de tela da rematrícula (PLANO.md 3.5).
//
// É a mesma decisão que o front toma no guard de rota, escrita de novo e separada do front:
//   servico-rematricula-frontend/src/config/router/gerenciadoresDeRotas/GerenciadorRotasPrioritarias.ts
//   (obterRotaPendenciaCasoExista + deveExigirAtualizacaoEnderecoParaContrato), chamado por
//   config/router/beforeEach.ts; a raiz "/" redireciona para /alteracaoResumo (router.ts).
//
// Dado o ObterInformacoesAluno gravado (o que o front recebeu), diz em que tela o front DEVE parar,
// qual regra decidiu e quais outras regras também valiam (perderam pela prioridade).
// O teste compara a tela obtida com esta, e não só com a tela que a gravação viu: "passou" passa a
// querer dizer "o front seguiu a regra", e não "o front repetiu o que fez na gravação".
//
// Se o front mudar a ordem ou uma condição, este arquivo precisa mudar junto (é a especificação).

export const FONTE_GERENCIADOR = 'GerenciadorRotasPrioritarias.ts';

const GRUPO_MEDICINA = 95; // Curso.CodigoGrupoCursoMedicina
const BLOQUEIO_CERTIFICADO = 2; // ETiposBloqueioAcesso.CertificadoConclusaoEnsinoMedioPendente
const TELA_CONFIRMACAO_ENVIO_MEDICINA = 1; // EnumTelasSistema.CONFIRMACAO_ENVIO_CONTRATO_MEDICINA
const TELA_PREVISUALIZACAO_GRADE = 5; // EnumTelasSistema.PREVISUALIZACAO_GRADE
const SITUACOES_CONFIRMADAS = [5, 2, 7]; // SituacaoDaDisciplina Confirmada, Reservada, Solicitada

/**
 * Redirects fixos do router.ts: a rota de cada regra já é a FINAL (depois do redirect).
 * Ficam aqui para conferência quando o router mudar.
 */
export const REDIRECTS = {
  '/': '/alteracaoResumo',
  '/erro/rematriculaSoftlaunch': '/erro/rematriculaNaoIniciada',
  '/erro/paginaNaoPermitida': '/erro/paginaNaoEncontrada',
  '/erro/sistemaIndisponivel': '/erro/erroDeSistema',
  '/erro/usuarioNaoAutenticado': '/erro/erroDeSistema',
};

const semPersona = a => a.identificadorPersona === null || a.identificadorPersona === undefined;
const foraDoPrazo = a => !a.estaNoSoftLaunch || !a.estaNoPeriodoAceiteContrato || !!a.possuiErroCadastro;
const medicina = a => a.codigoGrupoCursoAssociado === GRUPO_MEDICINA;
const telasBloqueadas = a => (Array.isArray(a.telasBloqueadas) ? a.telasBloqueadas : []);
const precisaContrato = a => !!a.estaNoPeriodoAceiteContrato && !!a.contratoEstaLiberado && !a.contratoEstaAceito && !medicina(a);
const escolhaPendente = a => !!(a.possuiEscolhaUcExploratoria || a.possuiEscolhaCoreCurriculum
  || a.possuiEscolhaPendenciaAcademica || a.possuiEscolhaUcPersonalizavel);

const PRAZO = ['estaNoSoftLaunch', 'estaNoPeriodoAceiteContrato', 'possuiErroCadastro'];
const CONTRATO = ['estaNoPeriodoAceiteContrato', 'contratoEstaLiberado', 'contratoEstaAceito', 'codigoGrupoCursoAssociado'];

/**
 * Regras em ordem de prioridade (a primeira que vale decide).
 * quando(a, ctx): a = ObterInformacoesAluno; ctx = { erroApi, disciplinaConfirmada }.
 * campos: o que a regra lê do ObterInformacoesAluno (a tela mostra os valores).
 */
export const REGRAS = [
  {
    id: 'erro-api',
    titulo: 'Erro ao carregar o aluno',
    rota: '/erro/erroDeSistema',
    condicao: 'ObterInformacoesAluno respondeu com erro (o front não tem dado para decidir)',
    fonte: 'AlunoService / beforeEach.ts',
    campos: [],
    quando: (a, ctx) => !!ctx.erroApi,
  },
  {
    id: 'mudanca-academica',
    titulo: 'Sem persona, com remanejamento vigente',
    rota: '/mudancaAcademica',
    condicao: 'identificadorPersona nulo E possuiRemanejamentoPeriodoVigente',
    fonte: FONTE_GERENCIADOR,
    campos: ['identificadorPersona', 'possuiRemanejamentoPeriodoVigente'],
    quando: a => semPersona(a) && !!a.possuiRemanejamentoPeriodoVigente,
  },
  {
    id: 'ajustando-grade',
    titulo: 'Sem persona, com rematrícula vigente',
    rota: '/ajustandoGradeHoraria',
    condicao: 'identificadorPersona nulo E possuiRematriculaVigenteSemPersona',
    fonte: FONTE_GERENCIADOR,
    campos: ['identificadorPersona', 'possuiRematriculaVigenteSemPersona'],
    quando: a => semPersona(a) && !!a.possuiRematriculaVigenteSemPersona,
  },
  {
    id: 'fora-prazo-contrato',
    titulo: 'Fora do prazo (E2A ou Radial), mas com contrato a aceitar',
    rota: '/contrato',
    condicao: 'fora do prazo (não está no soft launch, OU fora do período de aceite, OU erro de cadastro) E (indicadorE2a2 OU indicadorRadial) E contrato a aceitar (no período de aceite, liberado, não aceito, fora Medicina)',
    fonte: FONTE_GERENCIADOR,
    campos: [...PRAZO, 'indicadorE2a2', 'indicadorRadial', ...CONTRATO],
    quando: a => foraDoPrazo(a) && !!(a.indicadorRadial || a.indicadorE2a2) && precisaContrato(a),
  },
  {
    id: 'fora-prazo',
    titulo: 'Fora do prazo (E2A ou Radial)',
    rota: '/ForadePrazo',
    condicao: 'fora do prazo (não está no soft launch, OU fora do período de aceite, OU erro de cadastro) E (indicadorE2a2 OU indicadorRadial)',
    fonte: FONTE_GERENCIADOR,
    campos: [...PRAZO, 'indicadorE2a2', 'indicadorRadial'],
    quando: a => foraDoPrazo(a) && !!(a.indicadorRadial || a.indicadorE2a2),
  },
  {
    id: 'softlaunch',
    titulo: 'Fora do prazo, sem E2A nem Radial',
    // O gerenciador manda para /erro/rematriculaSoftlaunch, que o router.ts redireciona (REDIRECTS).
    rota: '/erro/rematriculaNaoIniciada',
    condicao: 'fora do prazo E não é E2A E não é Radial (o gerenciador manda para /erro/rematriculaSoftlaunch, que o router redireciona para /erro/rematriculaNaoIniciada)',
    fonte: `${FONTE_GERENCIADOR} + router.ts`,
    campos: [...PRAZO, 'indicadorE2a2', 'indicadorRadial'],
    quando: a => foraDoPrazo(a) && !a.indicadorE2a2 && !a.indicadorRadial,
  },
  {
    id: 'medicina-confirmacao-envio',
    titulo: 'Medicina: contrato aceito, confirmar envio',
    rota: '/contrato/confirmacao-envio',
    condicao: 'Medicina (grupo 95) E a tela de confirmação de envio não está em telasBloqueadas E contrato liberado E aceito',
    fonte: FONTE_GERENCIADOR,
    campos: ['codigoGrupoCursoAssociado', 'telasBloqueadas', 'contratoEstaLiberado', 'contratoEstaAceito'],
    quando: a => medicina(a) && !telasBloqueadas(a).includes(TELA_CONFIRMACAO_ENVIO_MEDICINA)
      && !!a.contratoEstaLiberado && !!a.contratoEstaAceito,
  },
  {
    id: 'certificado',
    titulo: 'Certificado do ensino médio pendente',
    rota: '/envioCertificado',
    condicao: 'tiposBloqueioAcesso contém 2 (certificado de conclusão do ensino médio pendente)',
    fonte: FONTE_GERENCIADOR,
    campos: ['tiposBloqueioAcesso'],
    quando: a => Array.isArray(a.tiposBloqueioAcesso) && a.tiposBloqueioAcesso.includes(BLOQUEIO_CERTIFICADO),
  },
  {
    id: 'contrato',
    titulo: 'Contrato liberado e não aceito',
    rota: '/contrato',
    condicao: 'no período de aceite E contrato liberado E não aceito E fora Medicina',
    fonte: FONTE_GERENCIADOR,
    campos: CONTRATO,
    quando: a => precisaContrato(a),
  },
  {
    id: 'medicina-assinatura-digital',
    titulo: 'Medicina: contrato não liberado, assinatura digital pendente',
    rota: '/pendencia/assinaturaDigital',
    condicao: 'Medicina (grupo 95) E contrato não liberado E não aceito',
    fonte: FONTE_GERENCIADOR,
    campos: ['codigoGrupoCursoAssociado', 'contratoEstaLiberado', 'contratoEstaAceito'],
    quando: a => medicina(a) && !a.contratoEstaLiberado && !a.contratoEstaAceito,
  },
  {
    id: 'pendencia-financeira',
    titulo: 'Contrato não liberado (pendência financeira)',
    rota: '/pendencia/financeira',
    // A API calcula possuiPendenciasFinanceiras = !contratoEstaLiberado && !IND_REG_FINANCEIRO
    // (servico-rematricula, ObterInformacoesAlunoService.ComporInformacoesFinanceiras): a flag só vale com
    // contrato não liberado. Na prática a regra é "o financeiro não liberou o contrato" (IND_CONTRATO_LIBERADO = 'N').
    condicao: 'contrato não liberado pelo financeiro (o front também testa possuiPendenciasFinanceiras, mas a API só a marca com contrato não liberado). Vem antes das escolhas de grade: o aluno não avança',
    fonte: FONTE_GERENCIADOR,
    campos: ['possuiPendenciasFinanceiras', 'contratoEstaLiberado'],
    quando: a => !!a.possuiPendenciasFinanceiras || !a.contratoEstaLiberado,
  },
  {
    id: 'pre-visualizacao-grade',
    titulo: 'Escolha pendente com disciplina já confirmada',
    rota: '/preVisualizacaoGrade',
    condicao: 'alguma escolha pendente (UC exploratória, core, pendência acadêmica, UC personalizável) E já existe disciplina confirmada/reservada/solicitada E fora Medicina E a pré-visualização não está em telasBloqueadas',
    fonte: FONTE_GERENCIADOR,
    campos: ['possuiEscolhaUcExploratoria', 'possuiEscolhaCoreCurriculum', 'possuiEscolhaPendenciaAcademica', 'possuiEscolhaUcPersonalizavel', 'codigoGrupoCursoAssociado', 'telasBloqueadas', 'disciplinaConfirmada'],
    quando: (a, ctx) => escolhaPendente(a) && !medicina(a)
      && !telasBloqueadas(a).includes(TELA_PREVISUALIZACAO_GRADE) && ctx.disciplinaConfirmada === true,
  },
  {
    id: 'uc-exploratoria',
    titulo: 'Escolha de UC exploratória pendente',
    rota: '/UcExploratoria',
    condicao: 'possuiEscolhaUcExploratoria',
    fonte: FONTE_GERENCIADOR,
    campos: ['possuiEscolhaUcExploratoria'],
    quando: a => !!a.possuiEscolhaUcExploratoria,
  },
  {
    id: 'core-curriculum',
    titulo: 'Escolha de core curriculum pendente',
    rota: '/CoreCurriculum',
    condicao: 'possuiEscolhaCoreCurriculum',
    fonte: FONTE_GERENCIADOR,
    campos: ['possuiEscolhaCoreCurriculum'],
    quando: a => !!a.possuiEscolhaCoreCurriculum,
  },
  {
    id: 'uc-personalizavel',
    titulo: 'Escolha de UC personalizável pendente',
    rota: '/UcPersonalizavel',
    condicao: 'possuiEscolhaUcPersonalizavel',
    fonte: FONTE_GERENCIADOR,
    campos: ['possuiEscolhaUcPersonalizavel'],
    quando: a => !!a.possuiEscolhaUcPersonalizavel,
  },
  {
    id: 'pendencia-academica',
    titulo: 'Escolha de pendência acadêmica',
    rota: '/pendenciasAcademica',
    condicao: 'possuiEscolhaPendenciaAcademica',
    fonte: FONTE_GERENCIADOR,
    campos: ['possuiEscolhaPendenciaAcademica'],
    quando: a => !!a.possuiEscolhaPendenciaAcademica,
  },
  {
    id: 'sem-pendencia',
    titulo: 'Nenhuma pendência: resumo da rematrícula',
    rota: '/alteracaoResumo',
    condicao: 'nenhuma regra acima vale (a raiz "/" redireciona para o resumo)',
    fonte: 'router.ts',
    campos: [],
    quando: () => true,
  },
];

/**
 * Desvio depois da decisão: quando o destino é /contrato (pelas regras "contrato" ou "fora-prazo-contrato"),
 * o guard roda de novo e manda para a atualização cadastral se o aluno não tem endereço.
 */
export const DESVIO_ENDERECO = {
  id: 'atualizacao-cadastral',
  titulo: 'Contrato a aceitar sem endereço cadastrado',
  rota: '/atualizacaoCadastral',
  condicao: 'o destino é /contrato E contrato a aceitar E possuiEndereco falso',
  fonte: `${FONTE_GERENCIADOR} (deveExigirAtualizacaoEnderecoParaContrato)`,
  campos: [...CONTRATO, 'possuiEndereco'],
  quando: a => precisaContrato(a) && !a.possuiEndereco,
};

/** Todas as regras que a tela lista, na ordem em que o front avalia (o desvio entra logo depois do contrato). */
export function listaDeRegras() {
  const lista = [];
  for (const r of REGRAS) {
    lista.push(r);
    if (r.id === 'contrato') lista.push(DESVIO_ENDERECO);
  }
  return lista.map((r, i) => ({ ordem: i + 1, id: r.id, titulo: r.titulo, rota: r.rota, condicao: r.condicao, fonte: r.fonte, campos: r.campos }));
}

export const IDS_REGRAS = new Set([...REGRAS.map(r => r.id), DESVIO_ENDERECO.id]);

const resumoRegra = r => ({ id: r.id, titulo: r.titulo, rota: r.rota });

/**
 * Estados que a API nunca devolve (o dado de uma combinação montada não pode cair aqui).
 * possuiPendenciasFinanceiras = !contratoEstaLiberado && !IND_REG_FINANCEIRO: com contrato liberado ela é sempre falsa.
 * @returns {string[]} uma frase por inconsistência
 */
export function inconsistencias(info) {
  const a = info ?? {};
  const r = [];
  if (a.possuiPendenciasFinanceiras && a.contratoEstaLiberado) {
    r.push('possuiPendenciasFinanceiras com contrato liberado não existe: a API só marca pendência financeira quando o contrato não está liberado.');
  }
  return r;
}

function valorDoCampo(a, ctx, campo) {
  if (campo === 'disciplinaConfirmada') return ctx.disciplinaConfirmada ?? null;
  return a[campo] === undefined ? null : a[campo];
}

/**
 * Decide a tela pelo dado do aluno.
 * @param {object|null} info ObterInformacoesAluno (null quando a API falhou)
 * @param {{ erroApi?: boolean, disciplinaConfirmada?: boolean }} ctx
 * @returns {{ regra, rota, aplicaveis, campos, avisos }}
 *   regra: a regra que decide; aplicaveis: todas as que valiam, na ordem (a primeira é a que decide);
 *   campos: valores lidos pelas regras aplicáveis; avisos: o que o oráculo não conseguiu saber.
 */
export function avaliar(info, ctx = {}) {
  const a = info ?? {};
  const c = { erroApi: !!ctx.erroApi || !info, disciplinaConfirmada: ctx.disciplinaConfirmada };
  const avisos = c.erroApi ? [] : inconsistencias(a).map(t => `Dado impossível: ${t}`);

  if (c.erroApi) {
    const r = REGRAS[0];
    return { regra: resumoRegra(r), rota: r.rota, aplicaveis: [resumoRegra(r)], campos: {}, avisos };
  }

  if (escolhaPendente(a) && c.disciplinaConfirmada === undefined) {
    avisos.push('A gravação não tem as disciplinas do aluno (alteracao-resumo): a pré-visualização da grade foi avaliada como "sem disciplina confirmada".');
  }

  const valem = REGRAS.slice(1).filter(r => r.id !== 'sem-pendencia' && r.quando(a, c));
  let decide = valem[0] ?? REGRAS.find(r => r.id === 'sem-pendencia');
  if (decide.rota === '/contrato' && DESVIO_ENDERECO.quando(a)) decide = DESVIO_ENDERECO;

  const aplicaveis = valem.length ? [...(decide === DESVIO_ENDERECO ? [DESVIO_ENDERECO] : []), ...valem] : [decide];
  const usados = new Set([...decide.campos, ...valem.flatMap(r => r.campos)]);
  const campos = Object.fromEntries([...usados].map(k => [k, valorDoCampo(a, c, k)]));

  return { regra: resumoRegra(decide), rota: decide.rota, aplicaveis: aplicaveis.map(resumoRegra), campos, avisos };
}

// ---------------------------------------------------------------------------
// Contexto a partir de uma gravação (HAR)
// ---------------------------------------------------------------------------

const INFORMACOES = /\/services\/.*ObterInformacoesAluno/i;
const DISCIPLINAS = /\/services\/.*disciplinasDisponiveis\/alunos\/\d+\/alteracao-resumo/i;

function corpoJson(entrada) {
  try {
    return JSON.parse(entrada?.response?.content?.text ?? '');
  } catch {
    return undefined;
  }
}

/**
 * O que o front recebeu na gravação: ObterInformacoesAluno (já com os avanços, como a reprodução serve)
 * e se havia disciplina confirmada. `ajuste` (combinações) sobrescreve campos do ObterInformacoesAluno.
 */
export function contextoDoHar(har, ajuste) {
  const entradas = har?.log?.entries ?? [];
  const info = entradas.find(e => INFORMACOES.test(e.request?.url ?? ''));
  const erroApi = !info || info.response?.status !== 200;
  let dados = erroApi ? null : corpoJson(info) ?? null;
  if (dados && ajuste) dados = { ...dados, ...ajuste };

  const disc = entradas.find(e => DISCIPLINAS.test(e.request?.url ?? '') && e.response?.status === 200);
  const lista = disc ? corpoJson(disc) : undefined;
  const disciplinaConfirmada = Array.isArray(lista) ? lista.some(d => SITUACOES_CONFIRMADAS.includes(d?.situacao)) : undefined;

  return { info: dados, erroApi: erroApi || !dados, disciplinaConfirmada, avancos: har?.log?._avancos ?? [] };
}

/** Avalia direto de um HAR. */
export function avaliarHar(har, ajuste) {
  const ctx = contextoDoHar(har, ajuste);
  return { ...avaliar(ctx.info, ctx), avancos: ctx.avancos };
}

/** Mesma tela? Compara só o caminho, sem diferenciar maiúsculas, sem query/hash e sem barra final. */
export function mesmaRota(a, b) {
  const norm = s => String(s ?? '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase() || '/';
  return norm(a) === norm(b);
}

/** Regras declaradas por um cenário: string ou lista (cenário que aceita mais de uma regra). */
export function regrasDeclaradas(regra) {
  if (!regra) return [];
  return Array.isArray(regra) ? regra : [regra];
}
