<script setup lang="ts">
/**
 * Confirma o descarte de um aluno de um cenário (a captura mostra que ele não condiz).
 * Apaga a gravação dele; o código vai para a lista de descartados e a esteira não o sorteia mais.
 */
export interface PedidoDescarte {
  cenario: string
  titulo?: string
  codigoAluno: number
  /** true quando é a gravação usada no teste (o cenário volta a "a gravar") */
  aprovado: boolean
  captura?: string
  /** Cenário de fonte databricks: dá para procurar outro aluno em seguida */
  podeGerar: boolean
}

const props = defineProps<{
  pedido: PedidoDescarte | null
  descartar: (motivo: string | undefined, gerarDeNovo: boolean) => Promise<void>
}>()
const emit = defineEmits<{ fechar: [] }>()

const motivo = ref('')
const gerarDeNovo = ref(true)
const enviando = ref(false)
const erro = ref<string | null>(null)

const open = computed({
  get: () => !!props.pedido,
  set: (v) => {
    if (!v) emit('fechar')
  }
})

watch(() => props.pedido, (p) => {
  if (!p) return
  motivo.value = ''
  gerarDeNovo.value = p.aprovado && p.podeGerar
  erro.value = null
})

async function confirmar() {
  enviando.value = true
  erro.value = null
  try {
    await props.descartar(motivo.value.trim() || undefined, gerarDeNovo.value && !!props.pedido?.podeGerar)
    emit('fechar')
  } catch (e) {
    erro.value = mensagemDeErro(e, 'Não foi possível descartar')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="pedido ? `Descartar o aluno ${pedido.codigoAluno}` : 'Descartar aluno'"
    :description="pedido ? `Cenário ${pedido.titulo ?? pedido.cenario}` : undefined"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div v-if="pedido" class="space-y-4">
        <img
          v-if="pedido.captura"
          :src="urlCaptura(pedido.captura)"
          :alt="`Captura do aluno ${pedido.codigoAluno}`"
          class="max-h-72 w-full rounded border border-gray-200 object-cover object-top dark:border-gray-800"
        >
        <UAlert
          :color="pedido.aprovado ? 'warning' : 'neutral'"
          variant="soft"
          icon="i-lucide-trash-2"
          :title="pedido.aprovado ? 'Este é o aluno usado no teste' : 'Candidato que a esteira tentou'"
          :description="pedido.aprovado
            ? 'A gravação e a captura são apagadas e o cenário volta a &quot;A gravar&quot;: o teste dele deixa de rodar até outro aluno ser gravado.'
            : 'A gravação e a captura deste candidato são apagadas.'"
        />
        <p class="text-sm text-gray-600 dark:text-gray-400">
          O código entra na lista de descartados deste cenário e a esteira passa a excluí-lo do SQL
          (<span class="font-mono">COD_ALUNO NOT IN (…)</span>). Dá para permitir de novo na aba Massa de teste.
        </p>
        <UFormField label="Motivo (opcional)" help="Ex.: na captura ele já está com a grade confirmada">
          <UInput v-model="motivo" class="w-full" maxlength="300" />
        </UFormField>
        <UCheckbox
          v-if="pedido.podeGerar"
          v-model="gerarDeNovo"
          label="Procurar outro aluno agora (roda a esteira para este cenário)"
        />
        <UAlert v-if="erro" color="error" variant="soft" icon="i-lucide-circle-alert" :title="erro" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="emit('fechar')">
          Cancelar
        </UButton>
        <UButton color="error" icon="i-lucide-trash-2" :loading="enviando" @click="confirmar">
          Descartar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
