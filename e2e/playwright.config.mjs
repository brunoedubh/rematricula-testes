import { defineConfig, devices } from '@playwright/test';
import { lerEnv } from './scripts/env.mjs';
import { idDaExecucao } from './scripts/execucao.mjs';

// ALVO: onde está o front. Padrão = Vue 2 publicado em HML. Depois da migração: o Vue 3 local.
const ALVO = lerEnv().ALVO || 'https://cloudapp-hml.animaeducacao.com.br/rematricula/';

// Cada execução guarda resumo, capturas e traces em resultados/ (histórico da aba Execução, PLANO.md 5).
const EXECUCAO = idDaExecucao(ALVO);

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  outputDir: `resultados/${EXECUCAO}/artefatos`,
  reporter: [['list'], ['html', { open: 'never' }], ['./scripts/resumo.mjs']],
  use: { baseURL: ALVO, screenshot: 'on', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
