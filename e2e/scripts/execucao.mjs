// Identificação de cada execução da suíte (PLANO.md 5): resultados/<id>.json + resultados/<id>/artefatos.
// O playwright.config e o reporter usam o mesmo id. Os workers herdam E2E_EXECUCAO do processo principal.

const pad = n => String(n).padStart(2, '0');

/** Nome curto do alvo para o id: hml, dev, local ou o host. */
export function nomeDoAlvo(alvo) {
  if (process.env.E2E_ALVO_NOME) return slug(process.env.E2E_ALVO_NOME);
  try {
    const { hostname } = new URL(alvo);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
    const m = hostname.match(/-(dev|hml)\./);
    if (m) return m[1];
    return slug(hostname);
  } catch {
    return 'alvo';
  }
}

export function slug(texto) {
  return String(texto).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'alvo';
}

/** 20261111-143005-hml */
export function novoIdExecucao(alvo, data = new Date()) {
  const d = `${data.getFullYear()}${pad(data.getMonth() + 1)}${pad(data.getDate())}`;
  const h = `${pad(data.getHours())}${pad(data.getMinutes())}${pad(data.getSeconds())}`;
  return `${d}-${h}-${nomeDoAlvo(alvo)}`;
}

export const ID_EXECUCAO = /^[0-9]{8}-[0-9]{6}-[a-z0-9-]{1,40}$/;

/** Fixa o id da execução no processo principal (antes de os workers nascerem). */
export function idDaExecucao(alvo) {
  if (!process.env.E2E_EXECUCAO || !ID_EXECUCAO.test(process.env.E2E_EXECUCAO)) {
    process.env.E2E_EXECUCAO = novoIdExecucao(alvo);
  }
  return process.env.E2E_EXECUCAO;
}
