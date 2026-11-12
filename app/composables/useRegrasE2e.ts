import type { RegraE2e, RespostaRegrasE2e } from '~~/types'

/**
 * Regras de tela (oráculo e2e/regras/regras.mjs), combinações e última execução (GET /api/e2e/regras).
 * Estado compartilhado entre as abas (useState): Regras, Execução e o formulário de cenário usam a mesma lista.
 */
export function useRegrasE2e() {
  const dados = useState<RespostaRegrasE2e | null>('e2e-regras', () => null)
  const carregando = useState('e2e-regras-carregando', () => false)
  const erro = useState<string | null>('e2e-regras-erro', () => null)

  const regras = computed(() => dados.value?.regras ?? [])
  const porId = computed(() => new Map<string, RegraE2e>(regras.value.map(r => [r.id, r])))

  async function carregar(): Promise<void> {
    carregando.value = true
    try {
      dados.value = await $fetch<RespostaRegrasE2e>('/api/e2e/regras')
      erro.value = null
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível ler as regras')
    } finally {
      carregando.value = false
    }
  }

  /** "Contrato liberado e não aceito" a partir do id (ou o próprio id, se a regra não existir mais) */
  function tituloRegra(id: string): string {
    return porId.value.get(id)?.titulo ?? id
  }

  return { dados, regras, porId, carregando, erro, carregar, tituloRegra }
}
