/**
 * GET /api/e2e/captura?caminho=gravacoes/<id>.png
 * Captura da tela final de uma gravação (só PNG dentro de e2e/gravacoes).
 * A captura mostra dados reais do aluno: exige sessão e não fica em cache compartilhado.
 */
import { promises as fs } from 'node:fs'
import { getSessionFromEvent } from '../../utils/session'
import { caminhoDaCaptura } from '../../utils/e2e/arquivos'

export default defineEventHandler(async (event) => {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  const caminho = caminhoDaCaptura(String(getQuery(event).caminho ?? ''))
  if (!caminho) {
    throw createError({ statusCode: 400, message: 'Caminho de captura inválido' })
  }

  try {
    const conteudo = await fs.readFile(caminho)
    setResponseHeaders(event, { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' })
    return conteudo
  } catch {
    throw createError({ statusCode: 404, message: 'Captura não encontrada' })
  }
})
