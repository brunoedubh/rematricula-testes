<script setup lang="ts">
/** Captura da tela final de uma gravação, em tamanho grande. */
const props = defineProps<{
  caminho: string | null
  titulo?: string
  /** A captura é de um aluno de um cenário: mostra "Descartar este aluno" */
  descartavel?: boolean
}>()
const emit = defineEmits<{ fechar: [], descartar: [] }>()

const open = computed({
  get: () => !!props.caminho,
  set: (v) => {
    if (!v) emit('fechar')
  }
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="titulo || 'Captura da gravação'"
    :description="caminho ?? undefined"
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <img
        v-if="caminho"
        :src="urlCaptura(caminho)"
        :alt="`Captura: ${titulo ?? caminho}`"
        class="mx-auto max-h-[75vh] w-auto max-w-full rounded border border-gray-200 object-contain dark:border-gray-800"
      >
    </template>
    <template v-if="descartavel" #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <span class="text-xs text-gray-500">A tela não condiz com o cenário?</span>
        <UButton color="error" variant="soft" icon="i-lucide-trash-2" @click="emit('descartar')">
          Descartar este aluno
        </UButton>
      </div>
    </template>
  </UModal>
</template>
