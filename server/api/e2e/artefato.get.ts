/**
 * GET /api/e2e/artefato?caminho=resultados/<id>/artefatos/<teste>/test-finished-1.png|execucao.gif|trace.zip
 * Captura, GIF do teste ou trace de uma execução da suíte (só dentro de e2e/resultados/<id>/artefatos).
 * O trace abre em `npx playwright show-trace <arquivo>` ou em trace.playwright.dev (roda local no navegador).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getSessionFromEvent } from '../../utils/session'
import { caminhoDoArtefato } from '../../utils/e2e/execucao'

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  const artefato = caminhoDoArtefato(String(getQuery(event).caminho ?? ''))
  if (!artefato) {
    throw createError({ statusCode: 400, message: 'Caminho de artefato inválido' })
  }

  try {
    const conteudo = await fs.readFile(artefato.caminho)
    const headers: Record<string, string> = { 'Content-Type': artefato.tipo, 'Cache-Control': 'private, no-store' }
    if (artefato.tipo === 'application/zip') {
      const pasta = path.basename(path.dirname(artefato.caminho)).replace(/[^\w-]+/g, '_')
      headers['Content-Disposition'] = `attachment; filename="trace-${pasta}.zip"`
    }
    setResponseHeaders(event, headers)
    return conteudo
  } catch {
    throw createError({ statusCode: 404, message: 'Artefato não encontrado' })
  }
})
