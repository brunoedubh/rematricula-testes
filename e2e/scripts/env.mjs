// Lê .env.local (fora do git) sem dependências.
import fs from 'node:fs';
export function lerEnv() {
  const env = {};
  if (fs.existsSync('.env.local')) {
    for (const linha of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2]) env[m[1]] = m[2];
    }
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => ['HML_LINK', 'ALVO'].includes(k))) };
}
