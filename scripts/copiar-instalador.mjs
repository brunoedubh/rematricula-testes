// Monta a pasta do instalador portátil a partir do build.
//
// 1. .output — o Nitro cria links (junctions no Windows) com caminho absoluto em
//    .output/server/node_modules quando há versões diferentes do mesmo pacote.
//    Copiar pelo Explorer deixa essas pastas vazias ("Cannot find package ...ufo").
//    Aqui os links são resolvidos e viram pastas reais (dereference: true).
// 2. e2e — o servidor lê/grava o catálogo e roda o Playwright nessa pasta.
//    Vai sem credenciais (.env.local), sem dados de alunos (gravacoes, *.local.json)
//    e sem resultados. Esses itens, se já existirem no destino, são preservados.
// 3. start.bat
//
// Destino padrão: ../rematricula-testes-instalador (sobrescreve com INSTALADOR_DIR).

import { cp, rm, readdir, lstat, access } from 'node:fs/promises'
import { resolve, join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const instalador = resolve(process.env.INSTALADOR_DIR ?? join(raiz, '..', 'rematricula-testes-instalador'))

// Caminhos de e2e/ (relativos, com "/") que nunca vão para o instalador.
const E2E_LOCAIS = new Set([
  '.env.local',
  'gravacoes',
  'resultados',
  'playwright-report',
  'test-results',
  'cenarios/alunos.local.json',
  'cenarios/descartados.local.json',
])

async function existe(caminho) {
  try {
    await access(caminho)
    return true
  } catch {
    return false
  }
}

async function contarLinks(dir) {
  let total = 0
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name)
    if ((await lstat(caminho)).isSymbolicLink()) total++
    else if (item.isDirectory()) total += await contarLinks(caminho)
  }
  return total
}

const relE2e = (base, caminho) => relative(base, caminho).split(sep).join('/')

/** Apaga do destino tudo que veio do repositório, preservando os dados locais. */
async function limparE2e(dir) {
  if (!(await existe(dir))) return
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name)
    const rel = relE2e(destinoE2e, caminho)
    if (E2E_LOCAIS.has(rel)) continue
    if (item.isDirectory() && [...E2E_LOCAIS].some(l => l.startsWith(`${rel}/`))) {
      await limparE2e(caminho)
      continue
    }
    await rm(caminho, { recursive: true, force: true })
  }
}

function falhar(msg) {
  console.error(msg)
  process.exit(1)
}

const origemOutput = join(raiz, '.output')
const destinoOutput = join(instalador, '.output')
const origemE2e = join(raiz, 'e2e')
const destinoE2e = join(instalador, 'e2e')

if (!(await existe(join(origemOutput, 'server', 'index.mjs')))) falhar(`Build não encontrado em ${origemOutput}. Rode "pnpm build" antes.`)
if (!(await existe(instalador))) falhar(`Pasta do instalador não encontrada: ${instalador}\nCrie a pasta (com node-portable) ou defina INSTALADOR_DIR.`)
if (!(await existe(join(origemE2e, 'node_modules', '@playwright', 'test')))) falhar('Playwright não instalado em e2e/. Rode: cd e2e && npm ci')

console.log(`Instalador: ${instalador}`)

console.log('- .output')
await rm(destinoOutput, { recursive: true, force: true })
await cp(origemOutput, destinoOutput, { recursive: true, dereference: true })

console.log('- e2e (sem .env.local, gravações, resultados e *.local.json)')
await limparE2e(destinoE2e)
await cp(origemE2e, destinoE2e, {
  recursive: true,
  dereference: true,
  filter: origem => !E2E_LOCAIS.has(relE2e(origemE2e, origem)),
})

console.log('- start.bat')
await cp(join(raiz, 'start.bat'), join(instalador, 'start.bat'))

const links = (await contarLinks(destinoOutput)) + (await contarLinks(destinoE2e))
if (links > 0) falhar(`Atenção: ${links} link(s) continuam na cópia; o instalador pode não funcionar em outra máquina.`)

const avisos = []
if (!(await existe(join(destinoE2e, '.env.local')))) avisos.push('e2e\\.env.local não existe: copie e2e\\.env.example e preencha HML_LINK (link da própria pessoa).')
avisos.push('Em cada máquina, uma vez: node-portable\\node.exe e2e\\node_modules\\@playwright\\test\\cli.js install chromium')

console.log('\nInstalador atualizado.')
for (const aviso of avisos) console.log(`  * ${aviso}`)
