import { COLUNAS_VIEW_E2E } from '../../../types'

/**
 * WHERE escrito à mão na tela (Filtro SQL do cenário), validado antes de ir para o Databricks.
 * O projeto monta o SQL concatenando texto (sem parâmetros), então o WHERE passa por uma lista branca de tokens:
 * só colunas da view (COLUNAS_VIEW_E2E), números, textos entre aspas simples, operadores de comparação,
 * AND/OR/NOT/IN/IS/NULL/LIKE/BETWEEN, LOWER/UPPER/TRIM e parênteses. Qualquer outra coisa (";", comentários,
 * SELECT, outra tabela, barra invertida) é recusada com a posição do problema.
 */

export class WhereInvalidoError extends Error {}

export const COLUNAS_VIEW = new Set(COLUNAS_VIEW_E2E.map(c => c.coluna))

const PALAVRAS = new Set(['AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'TRUE', 'FALSE', 'LOWER', 'UPPER', 'TRIM'])

const TOKEN = /\s+|'(?:[^'\\]|'')*'|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|<=|>=|<>|!=|=|<|>|\(|\)|,/y

const MAX = 2000

/** Valida e devolve o WHERE (sem a palavra WHERE), com espaços normalizados. */
export function validarWhere(entrada: string): string {
  const where = entrada.trim().replace(/^where\s+/i, '')
  if (!where) throw new WhereInvalidoError('O WHERE está vazio.')
  if (where.length > MAX) throw new WhereInvalidoError(`O WHERE passou de ${MAX} caracteres.`)

  let pos = 0
  let parenteses = 0
  let colunas = 0
  const partes: string[] = []
  while (pos < where.length) {
    TOKEN.lastIndex = pos
    const m = TOKEN.exec(where)
    if (!m || m.index !== pos) {
      throw new WhereInvalidoError(`Trecho não permitido na posição ${pos + 1}: "${where.slice(pos, pos + 12)}"`)
    }
    const t = m[0]
    pos += t.length
    if (/^\s+$/.test(t)) continue

    if (/^[A-Za-z_]/.test(t)) {
      const maiusculo = t.toUpperCase()
      if (COLUNAS_VIEW.has(maiusculo)) {
        colunas++
        partes.push(maiusculo)
      } else if (PALAVRAS.has(maiusculo)) {
        partes.push(maiusculo)
      } else {
        throw new WhereInvalidoError(`"${t}" não é coluna da view nem palavra permitida. Colunas: veja a lista ao lado.`)
      }
      continue
    }
    if (t === '(') parenteses++
    if (t === ')' && --parenteses < 0) throw new WhereInvalidoError('Parêntese fechado sem abrir.')
    if (t.startsWith('\'') && t.length > 202) throw new WhereInvalidoError('Texto entre aspas com mais de 200 caracteres.')
    partes.push(t)
  }
  if (parenteses !== 0) throw new WhereInvalidoError('Parêntese aberto sem fechar.')
  if (!colunas) throw new WhereInvalidoError('O WHERE precisa usar pelo menos uma coluna da view.')

  // Junta sem espaço antes de "," e ")", depois de "(" e entre função e "(" (só estética do SQL mostrado).
  return partes.join(' ')
    .replace(/\s+([,)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\b(LOWER|UPPER|TRIM)\s+\(/g, '$1(')
}
