// Classifica uma gravação pela tela real em que o app parou (PLANO.md 3.3, passo 6).
// Quem define o cenário é a rota final, não o indicador do Databricks.
//
// Uso: node scripts/classificar.mjs "<regex da rota esperada>" "<url final>"
import { pathToFileURL } from 'node:url';

// Telas que indicam que o aluno não abriu em HML (não existe, sessão recusada, erro genérico).
// Estas telas não são cenários deste aluno: a esteira passa para o próximo candidato.
const NAO_ABRIU = [
  /\/autorizacao/i,
  /\/erro\/erroDeSistema/i,
  /\/erro\/usuarioNaoAutenticado/i,
  /\/erro\/paginaNaoPermitida/i,
  /\/erro\/paginaNaoEncontrada/i,
  /\/erro\/sistemaIndisponivel/i,
];

/** Rota "legível" a partir da URL final (sem o prefixo /rematricula/). */
export function rotaDaUrl(url) {
  try {
    return new URL(url).pathname.replace(/^\/rematricula\/?/i, '').replace(/\/$/, '');
  } catch {
    return String(url ?? '');
  }
}

/**
 * @param {{ esperado?: string | null, url: string }} p
 *   esperado: regex da rota (a mesma usada no teste: new RegExp(rota, 'i') contra a URL inteira).
 * @returns {{ resultado: 'confere' | 'nao-abriu' | 'outra-tela' | 'sem-esperado', rota: string }}
 */
export function classificar({ esperado, url }) {
  const rota = rotaDaUrl(url);
  // A esperada vem primeiro: um cenário pode ser justamente uma tela de erro (ex.: erro-api-aluno).
  if (esperado && new RegExp(esperado, 'i').test(url)) return { resultado: 'confere', rota };
  if (NAO_ABRIU.some(r => r.test(url))) return { resultado: 'nao-abriu', rota };
  if (!esperado) return { resultado: 'sem-esperado', rota };
  return { resultado: 'outra-tela', rota };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [esperado, url] = process.argv.slice(2);
  if (!url) { console.error('Uso: node scripts/classificar.mjs "<regex da rota esperada>" "<url final>"'); process.exit(1); }
  console.log(JSON.stringify(classificar({ esperado: esperado || null, url })));
}
