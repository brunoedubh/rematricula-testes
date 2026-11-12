// Grava as respostas reais da API do HML num HAR. SÓ LEITURA: não clica em nada.
// Telas que travam antes da tela do cenário (certificado, contrato) são avançadas ajustando a resposta
// de ObterInformacoesAluno, sem gravar nada no HML (scripts/avancos.mjs, PLANO.md 3.3.1).
//
// Manual:  npm run gravar -- <id-do-cenario> <codigoAluno>
//          (usa o HML_LINK do .env.local trocando o código do aluno no fim)
//
// Esteira: node scripts/gravar.mjs --link <url> --saida <caminho-sem-extensao> [--esperado <regex>] [--json]
//          O link também pode vir pela variável E2E_LINK (preferível: não aparece na lista de processos).
//          Com --json, os logs vão para o stderr e a última linha do stdout é o resultado em JSON:
//          { ok, url, rota, resultado, har, png, apis: [{ metodo, status, caminho }], avancos: [], aluno, regra, erro? }
//          regra = regra de tela que vale para o dado gravado (regras/regras.mjs): { id, titulo, rota, aplicaveis }.
//
// --regra <id[,id]>  regra(s) que o cenário exercita. Se o aluno abriu na tela certa ou sem esperado, mas o dado
//          dele cai em outra regra, o resultado é "outra-regra": o aluno não serve para o cenário (PLANO.md 3.5).
//          aluno = resumo sem dados pessoais de ObterInformacoesAluno (scripts/aluno.mjs). O mesmo resultado
//          fica anotado no HAR em log._e2e (a tela lê de lá depois que o servidor reinicia).
//
// --avancar auto (padrão) | nao | certificado,contrato
//          auto = avança tudo que não for a própria tela do cenário (o --esperado casa com a rota do avanço).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { lerEnv } from './env.mjs';
import { classificar } from './classificar.mjs';
import { avancosPara, aplicarAvancos, ENDPOINT_INFORMACOES, AVANCOS } from './avancos.mjs';
import { resumoDoHar } from './aluno.mjs';
import { avaliarHar } from '../regras/regras.mjs';

const { values: op, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    link: { type: 'string' },
    saida: { type: 'string' },
    esperado: { type: 'string' },
    regra: { type: 'string' },
    avancar: { type: 'string', default: 'auto' },
    json: { type: 'boolean', default: false },
  },
});

const log = (...a) => (op.json ? console.error : console.log)(...a);
const falhar = msg => {
  if (op.json) console.log(JSON.stringify({ ok: false, erro: msg }));
  else console.error(msg);
  process.exit(1);
};

let link, saida, manual;
if (op.link || process.env.E2E_LINK) {
  link = op.link || process.env.E2E_LINK;
  if (!op.saida) falhar('Informe --saida <caminho-sem-extensao>.');
  saida = op.saida;
} else {
  const [id, codigo] = positionals;
  if (!id || !codigo) falhar('Uso: npm run gravar -- <id-do-cenario> <codigoAluno>');
  const { HML_LINK } = lerEnv();
  if (!HML_LINK) falhar('Defina HML_LINK no .env.local (veja .env.example).');
  link = HML_LINK.replace(/\/[0-9]+$/, '/' + codigo);
  saida = `gravacoes/${id}`;
  manual = { id, codigo };
  // No modo manual, o esperado vem do catálogo (decide quais telas avançar).
  if (!op.esperado) {
    const c = JSON.parse(fs.readFileSync('cenarios/catalogo.json', 'utf8')).cenarios.find(x => x.id === id);
    op.esperado = c?.esperado?.rota;
    if (!op.regra && c?.regra) op.regra = [].concat(c.regra).join(',');
  }
}

let usar;
try {
  usar = avancosPara(op.esperado || null, op.avancar);
} catch (e) {
  falhar(e.message);
}
const avancados = new Set();

fs.mkdirSync(path.dirname(saida), { recursive: true });
const har = `${saida}.har`;
const png = `${saida}.png`;
const apis = [];

const browser = await chromium.launch();
let url;
try {
  const ctx = await browser.newContext({ recordHar: { path: har, content: 'embed', urlFilter: /\/rematricula\/services\// } });
  const page = await ctx.newPage();
  // Não gera eventos de analytics/chat em nome de ninguém.
  await page.route('**/*', r => /googletagmanager|force\.com|cloudflareinsights|google-analytics/.test(r.request().url()) ? r.abort() : r.continue());
  // Avanços: ajusta a resposta como ficaria depois do envio do certificado / aceite do contrato.
  // Registrada depois, tem prioridade sobre a rota acima. O HAR guarda a resposta ajustada.
  if (usar.length) {
    await page.route(ENDPOINT_INFORMACOES, async route => {
      const resposta = await route.fetch();
      let corpo = await resposta.text();
      try {
        const info = JSON.parse(corpo);
        const aplicados = aplicarAvancos(info, usar);
        if (aplicados.length) {
          corpo = JSON.stringify(info);
          for (const a of aplicados) {
            if (!avancados.has(a)) log('Avanço:', AVANCOS.find(x => x.id === a).descricao);
            avancados.add(a);
          }
        }
      } catch {
        // Erro da API ou corpo que não é JSON: vai como veio.
      }
      await route.fulfill({ response: resposta, body: corpo });
    });
  }
  page.on('response', r => {
    if (!r.url().includes('/services/')) return;
    const caminho = r.url().split('/services/')[1].split('?')[0];
    apis.push({ metodo: r.request().method(), status: r.status(), caminho });
    log('API', r.request().method(), r.status(), caminho);
  });
  page.on('pageerror', e => log('ERRO JS:', e.message.slice(0, 150)));
  try {
    await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 });
  } catch (e) {
    // networkidle pode não chegar (polling); a tela em que parou ainda vale.
    log('Aviso na navegação:', e.message.split('\n')[0]);
  }
  await page.waitForTimeout(4000);
  url = page.url();
  await page.screenshot({ path: png, fullPage: true });
  await ctx.close();
} catch (e) {
  await browser.close();
  falhar(`Falha ao gravar: ${e.message.split('\n')[0]}`);
}
await browser.close();

let { resultado, rota } = classificar({ esperado: op.esperado || null, url });
log('Tela final:', rota.startsWith('autorizacao') ? '(não saiu da autorização)' : rota, `→ ${resultado}`);
const avancos = [...avancados];
if (avancos.length) log('Avançou:', avancos.join(', '));

// Anota no próprio HAR (campos próprios com "_", permitidos pela especificação): quem promover a gravação
// sabe que houve avanço, e a tela mostra rota, resultado e aluno mesmo depois de o servidor reiniciar.
let aluno = null;
let regra = null;
try {
  const conteudo = JSON.parse(fs.readFileSync(har, 'utf8'));
  aluno = resumoDoHar(conteudo);
  const r = avaliarHar(conteudo);
  regra = { id: r.regra.id, titulo: r.regra.titulo, rota: r.rota, aplicaveis: r.aplicaveis.map(x => x.id) };
  const declaradas = (op.regra ?? '').split(',').map(x => x.trim()).filter(Boolean);
  if (declaradas.length && ['confere', 'sem-esperado'].includes(resultado) && !declaradas.includes(regra.id)) {
    log(`Regra do aluno: ${regra.titulo} (${regra.id}); o cenário pede ${declaradas.join(' ou ')} → outra-regra`);
    resultado = 'outra-regra';
  }
  if (avancos.length) conteudo.log._avancos = avancos;
  conteudo.log._e2e = { gravadoEm: new Date().toISOString(), rota, resultado, esperado: op.esperado || null, avancos, aluno, regra };
  fs.writeFileSync(har, JSON.stringify(conteudo));
} catch (e) {
  log('Aviso: não foi possível anotar o HAR:', e.message);
}
if (aluno) {
  log('Aluno no HML:', `período ${aluno.periodoLetivo} (${aluno.codigoPeriodoLetivo}), curso ${aluno.codigoCurso}, persona ${aluno.persona}, soft launch: ${aluno.estaNoSoftLaunch ? 'sim' : 'não'}`);
}

if (manual) {
  const arq = 'cenarios/alunos.local.json';
  const alunos = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : {};
  alunos[manual.id] = Number(manual.codigo);
  fs.writeFileSync(arq, JSON.stringify(alunos, null, 2) + '\n');
  console.log(`Gravado: ${har}. Atualize cenarios/catalogo.json (status "gravado" e "esperado"${avancos.length ? `; "avancos": ${JSON.stringify(avancos)}` : ''}).`);
}
if (op.json) console.log(JSON.stringify({ ok: true, url: url.replace(/\/token\/.*/, '/token/…'), rota, resultado, har, png, apis, avancos, aluno, regra }));
