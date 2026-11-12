import { z } from 'zod'

/** Valor aceito numa chave do perfil (catalogo.ts → condicao): texto, número, booleano, null ou lista. */
export const valorPerfilSchema = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(20), z.number()])).max(200)
])
