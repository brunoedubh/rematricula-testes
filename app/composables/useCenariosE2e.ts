import type { CenarioE2e, ResultadoCenarioE2e, RespostaCenariosE2e } from '~~/types'

/**
 * Estado da tela "Cenários E2E" (e2e/PLANO.md 4): catálogo, gravações, esteira e ações.
 * Enquanto a esteira roda, consulta de novo a cada 3 s.
 * Ações que geram token de HML pedem a senha quando a sessão não a tem (pedirSenha).
 */

const INTERVALO_MS = 3000

interface RespostaComSenha {
  success: boolean
  requiresPassword?: boolean
  error?: string
}

export function useCenariosE2e() {
  const dados = ref<RespostaCenariosE2e | null>(null)
  const carregando = ref(false)
  const erro = ref<string | null>(null)
  /** Ação em andamento nesta tela (gravar é síncrono e leva ~30 s) */
  const ocupado = ref(false)

  /** Pedido de senha aberto: o modal chama responderSenha */
  const senhaPedida = ref(false)
  let resolverSenha: ((senha: string | null) => void) | null = null

  const cenarios = computed(() => dados.value?.cenarios ?? [])
  const esteira = computed(() => dados.value?.esteira ?? null)
  const rodando = computed(() => !!esteira.value?.rodando || ocupado.value)

  let timer: ReturnType<typeof setTimeout> | undefined

  async function carregar(): Promise<void> {
    carregando.value = true
    try {
      dados.value = await $fetch<RespostaCenariosE2e>('/api/e2e/cenarios')
      erro.value = null
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível ler o catálogo')
    } finally {
      carregando.value = false
    }
  }

  function acompanhar(): void {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      await carregar()
      if (rodando.value) acompanhar()
    }, INTERVALO_MS)
  }

  function pedirSenha(): Promise<string | null> {
    senhaPedida.value = true
    return new Promise((resolve) => {
      resolverSenha = resolve
    })
  }

  function responderSenha(senha: string | null): void {
    senhaPedida.value = false
    resolverSenha?.(senha)
    resolverSenha = null
  }

  /** Chama a rota; se faltar a senha na sessão, pede e tenta de novo uma vez. */
  async function comSenha<T extends RespostaComSenha>(chamar: (password?: string) => Promise<T>): Promise<T | null> {
    const r = await chamar()
    if (!r.requiresPassword) return r
    const senha = await pedirSenha()
    if (!senha) return null
    return chamar(senha)
  }

  /** ① Geração automática em segundo plano (todos os pendentes ou os ids informados). */
  async function gerar(ids?: string[]): Promise<void> {
    erro.value = null
    try {
      const r = await comSenha(password => $fetch<RespostaComSenha>('/api/e2e/gerar', {
        method: 'POST',
        body: { ids, password }
      }))
      if (r && !r.success) erro.value = r.error ?? 'Não foi possível iniciar a geração'
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível iniciar a geração')
    }
    await carregar()
    if (rodando.value) acompanhar()
  }

  /** ② Grava um aluno informado para um cenário (síncrono). */
  async function gravar(id: string, codigoAluno: number, liberar: boolean): Promise<{ resultado?: ResultadoCenarioE2e, erro?: string }> {
    ocupado.value = true
    acompanhar()
    try {
      const r = await comSenha(password => $fetch<RespostaComSenha & { resultado?: ResultadoCenarioE2e }>('/api/e2e/gravar', {
        method: 'POST',
        body: { id, codigoAluno, liberar, password }
      }))
      if (!r) return { erro: 'Cancelado' }
      if (!r.success) return { erro: r.error ?? 'Erro ao gravar' }
      return { resultado: r.resultado }
    } catch (e) {
      return { erro: mensagemDeErro(e, 'Erro ao gravar') }
    } finally {
      ocupado.value = false
      await carregar()
    }
  }

  async function criar(corpo: Record<string, unknown>): Promise<CenarioE2e> {
    const r = await $fetch<{ cenario: CenarioE2e }>('/api/e2e/cenarios', { method: 'POST', body: corpo })
    await carregar()
    return r.cenario
  }

  async function alterar(id: string, corpo: Record<string, unknown>): Promise<CenarioE2e> {
    const r = await $fetch<{ cenario: CenarioE2e }>(`/api/e2e/cenarios/${id}`, { method: 'PATCH', body: corpo })
    await carregar()
    return r.cenario
  }

  onMounted(async () => {
    await carregar()
    if (rodando.value) acompanhar()
  })
  onBeforeUnmount(() => clearTimeout(timer))

  return {
    dados, cenarios, esteira, carregando, erro, ocupado, rodando,
    senhaPedida, responderSenha,
    carregar, gerar, gravar, criar, alterar
  }
}
