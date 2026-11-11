import { spawn } from 'node:child_process'
import { pastaE2e } from './catalogo'

/**
 * Chama os scripts do motor e2e como processo filho (e2e/PLANO.md 2).
 * O link (com o token) vai pela variável E2E_LINK: não aparece na lista de processos nem nos logs.
 */

export interface ResultadoGravacao {
  ok: boolean
  url?: string
  rota?: string
  resultado?: 'confere' | 'nao-abriu' | 'outra-tela' | 'sem-esperado'
  /** Caminhos relativos a e2e/ */
  har?: string
  png?: string
  apis?: { metodo: string, status: number, caminho: string }[]
  /** Telas que travavam e foram avançadas na gravação (e2e/scripts/avancos.mjs) */
  avancos?: string[]
  erro?: string
}

const TEMPO_MAXIMO_MS = 3 * 60 * 1000

/**
 * Roda `node scripts/gravar.mjs --json --saida <saida> [--esperado <regex>]` dentro de e2e/.
 * @param saida caminho sem extensão, relativo a e2e/ (ex.: gravacoes/candidatos/pendencia-financeira-123)
 */
export function gravarComLink(link: string, saida: string, esperado?: string): Promise<ResultadoGravacao> {
  const args = ['scripts/gravar.mjs', '--json', '--saida', saida]
  if (esperado) args.push('--esperado', esperado)

  return new Promise((resolve) => {
    const filho = spawn(process.execPath, args, {
      cwd: pastaE2e(),
      env: { ...process.env, E2E_LINK: link },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''
    filho.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    filho.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    const limite = setTimeout(() => {
      filho.kill()
    }, TEMPO_MAXIMO_MS)

    filho.on('error', (e) => {
      clearTimeout(limite)
      resolve({ ok: false, erro: `Não foi possível iniciar o gravador: ${e.message}` })
    })

    filho.on('close', (codigo) => {
      clearTimeout(limite)
      const ultima = stdout.trim().split(/\r?\n/).pop() ?? ''
      try {
        resolve(JSON.parse(ultima) as ResultadoGravacao)
      } catch {
        const detalhe = stderr.trim().split(/\r?\n/).slice(-3).join(' | ')
        resolve({ ok: false, erro: `Gravador terminou sem resultado (código ${codigo}). ${detalhe}`.trim() })
      }
    })
  })
}
