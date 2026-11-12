// Sessão falsa + API reproduzida da gravação. Nenhuma chamada sai para fora.
import fs from 'node:fs';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

export function sessaoFake(codigo) {
  const agora = Math.floor(Date.now() / 1000);
  const claims = { exp: agora + 3600, nbf: agora - 60, sub: 'funcionario.teste', given_name: 'Teste', family_name: 'Automatizado', email: 'teste@example.com', isColaborador: 'true', isUsuario: 'true' };
  const token = `${b64({ typ: 'JWT', alg: 'RS256' })}.${b64(claims)}.x`;
  return JSON.stringify({ usuario: { login: 'funcionario.teste', email: 'teste@example.com', nome: 'Teste', sobrenome: 'Automatizado', nomeCompleto: 'Teste Automatizado', codigo }, usuarioDecodificado: claims, token, impersonate: true });
}

// Chave de casamento: método + caminho a partir de "/services/" + query ordenada.
// Ignora host e prefixo, então a mesma gravação serve para HML, DEV e o Vue 3 local.
const MARCA = '/services/';
export function chave(metodo, url) {
  const u = new URL(url);
  const i = u.pathname.indexOf(MARCA);
  if (i < 0) return null;
  const query = [...u.searchParams].sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
  const qs = new URLSearchParams(query).toString();
  return `${metodo.toUpperCase()} ${u.pathname.slice(i + MARCA.length)}${qs ? '?' + qs : ''}`;
}

// Headers que não podem ser repassados como vieram (o corpo já está decodificado) ou que não interessam.
const HEADERS_FORA = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie', 'keep-alive']);

export function lerGravacao(arquivo) {
  const har = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const filas = new Map();
  for (const e of har.log.entries) {
    const k = chave(e.request.method, e.request.url);
    if (!k) continue;
    if (!filas.has(k)) filas.set(k, []);
    filas.get(k).push(e);
  }
  return filas;
}

// Código do aluno a partir da própria gravação (ObterInformacoesAluno?codigoAluno=N).
// Assim o teste não depende do alunos.local.json, que fica fora do git.
export function codigoDaGravacao(arquivo) {
  for (const k of lerGravacao(arquivo).keys()) {
    const m = k.match(/ObterInformacoesAluno\?(?:.*&)?codigoAluno=(\d+)/i);
    if (m) return Number(m[1]);
  }
  return undefined;
}

// CORS da resposta servida pelo teste (o front chama a API em outro host).
export function corsDe(req) {
  const origem = req.headers()['origin'];
  return origem ? { 'access-control-allow-origin': origem, 'access-control-allow-credentials': 'true' } : {};
}

// Reprodutor por método + caminho. Chamadas repetidas saem na ordem gravada; esgotada a fila, repete a última.
// Com mais de uma gravação para a mesma chave, prefere a de corpo igual (POST/PUT).
// ajustar(fn): a partir dali, toda resposta JSON passa por fn(chave, corpo) antes de ir para o front.
// É o "estado depois da ação" dos fluxos com escrita (PLANO.md 5.1): ex. contrato aceito no ObterInformacoesAluno.
export async function reproduzir(page, arquivo) {
  const filas = lerGravacao(arquivo);
  const usadas = new Map();
  const semGravacao = [];
  const ajustes = [];

  await page.route(u => u.pathname.includes(MARCA), async route => {
    const req = route.request();
    const cors = corsDe(req);
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { ...cors, 'access-control-allow-methods': '*', 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*' } });
    }
    const k = chave(req.method(), req.url());
    const fila = filas.get(k);
    if (!fila) { semGravacao.push(k); return route.abort(); }

    let e;
    const corpo = req.postData();
    const mesmoCorpo = fila.length > 1 && corpo != null ? fila.find(x => x.request.postData?.text === corpo) : undefined;
    if (mesmoCorpo) e = mesmoCorpo;
    else {
      const n = usadas.get(k) ?? 0;
      e = fila[Math.min(n, fila.length - 1)];
      usadas.set(k, n + 1);
    }

    const c = e.response.content;
    const headers = Object.fromEntries(e.response.headers.filter(h => !HEADERS_FORA.has(h.name.toLowerCase())).map(h => [h.name.toLowerCase(), h.value]));
    let body = c.text == null ? '' : c.encoding === 'base64' ? Buffer.from(c.text, 'base64') : c.text;
    if (ajustes.length && /json/i.test(c.mimeType ?? '') && typeof body === 'string' && body) {
      let json = JSON.parse(body);
      for (const fn of ajustes) json = fn(k, json) ?? json;
      body = JSON.stringify(json);
    }
    return route.fulfill({ status: e.response.status, headers: { ...headers, ...cors }, body });
  });

  return { semGravacao, ajustar: fn => ajustes.push(fn) };
}

/**
 * Abre o front com a gravação do cenário.
 * opcoes.ajusteInformacoes: campos que sobrescrevem o ObterInformacoesAluno gravado (combinações de regras),
 * aplicados antes da primeira chamada.
 */
export async function abrirComGravacao(page, idCenario, codigo, baseURL, opcoes = {}) {
  const origem = new URL(baseURL).origin;
  const arquivo = `gravacoes/${idCenario}.har`;
  // Bloqueia tudo que sai da origem do front (exceto fontes). A rota da API, registrada depois, tem prioridade.
  await page.route(u => u.origin !== origem && !/fonts\.(googleapis|gstatic)/.test(u.host), r => r.abort());
  const reprodutor = await reproduzir(page, arquivo);
  if (opcoes.ajusteInformacoes) {
    const ajuste = opcoes.ajusteInformacoes;
    reprodutor.ajustar((k, json) => (/ObterInformacoesAluno/i.test(k) && json && typeof json === 'object' ? { ...json, ...ajuste } : json));
  }
  await page.addInitScript(s => localStorage.setItem('ANIMA_REMATRICULA_KEY', s), sessaoFake(codigo ?? codigoDaGravacao(arquivo)));
  await page.goto('');
  await page.waitForLoadState('networkidle');
  return reprodutor;
}

// Rota onde o app parou, relativa ao ALVO (aba Execução: tela esperada × obtida).
export function rotaRelativa(url, base) {
  try {
    const u = new URL(url);
    const b = new URL(base);
    const caminho = u.pathname.startsWith(b.pathname) ? u.pathname.slice(b.pathname.length) : u.pathname;
    return `/${caminho.replace(/^\/+/, '')}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}
