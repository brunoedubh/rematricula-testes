import type { ExecucaoE2e, RespostaExecucoesE2e } from '~~/types'

/**
 * Estado da aba Execução (e2e/PLANO.md 5): alvos, histórico e a execução selecionada.
 * Enquanto a suíte roda, consulta de novo a cada 2 s (o reporter atualiza o arquivo a cada teste).
 */

const INTERVALO_MS = 2000

export interface PedidoExecucaoE2e {
  alvo: 'hml' | 'local' | 'dev'
  dispositivos: string[]
  cenarios?: string[]
}

export function useExecucoesE2e() {
  const dados = ref<RespostaExecucoesE2e | null>(null)
  const selecionada = ref<string | null>(null)
  const execucao = ref<ExecucaoE2e | null>(null)
  const carregando = ref(false)
  const erro = ref<string | null>(null)

  const rodando = computed(() => !!dados.value?.estado.rodando)
  const execucoes = computed(() => dados.value?.execucoes ?? [])

  let timer: ReturnType<typeof setTimeout> | undefined

  async function carregarExecucao(id: string): Promise<void> {
    try {
      execucao.value = await $fetch<ExecucaoE2e>(`/api/e2e/execucoes/${id}`)
    } catch {
      // Ainda sem arquivo (Playwright iniciando) ou removida pela limpeza: mantém o que havia.
      if (execucao.value?.id !== id) execucao.value = null
    }
  }

  async function carregar(): Promise<void> {
    carregando.value = true
    try {
      dados.value = await $fetch<RespostaExecucoesE2e>('/api/e2e/execucoes')
      erro.value = null
      const atual = dados.value.estado.rodando ? dados.value.estado.id : undefined
      if (atual) selecionada.value = atual
      else if (!selecionada.value || !execucoes.value.some(e => e.id === selecionada.value)) {
        selecionada.value = execucoes.value[0]?.id ?? null
      }
      if (selecionada.value) await carregarExecucao(selecionada.value)
      else execucao.value = null
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível ler as execuções')
    } finally {
      carregando.value = false
    }
  }

  function acompanhar(): void {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const estava = rodando.value
      await carregar()
      // Mais uma leitura depois de terminar, para pegar o resumo final.
      if (rodando.value || estava) acompanhar()
    }, INTERVALO_MS)
  }

  async function selecionar(id: string): Promise<void> {
    selecionada.value = id
    await carregarExecucao(id)
  }

  async function executar(pedido: PedidoExecucaoE2e): Promise<boolean> {
    erro.value = null
    try {
      const r = await $fetch<{ success: boolean, id: string }>('/api/e2e/execucoes', { method: 'POST', body: pedido })
      selecionada.value = r.id
      execucao.value = null
      await carregar()
      acompanhar()
      return true
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível iniciar a execução')
      return false
    }
  }

  async function cancelar(): Promise<void> {
    try {
      await $fetch('/api/e2e/execucoes/cancelar', { method: 'POST' })
    } catch (e) {
      erro.value = mensagemDeErro(e, 'Não foi possível cancelar')
    }
    acompanhar()
  }

  onMounted(async () => {
    await carregar()
    if (rodando.value) acompanhar()
  })
  onBeforeUnmount(() => clearTimeout(timer))

  return {
    dados, execucoes, selecionada, execucao, carregando, erro, rodando,
    carregar, selecionar, executar, cancelar
  }
}
