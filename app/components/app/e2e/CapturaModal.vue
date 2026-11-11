<script setup lang="ts">
/** Captura da tela final de uma gravação, em tamanho grande. */
const props = defineProps<{
  caminho: string | null
  titulo?: string
}>()
const emit = defineEmits<{ fechar: [] }>()

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
        class="w-full rounded border border-gray-200 dark:border-gray-800"
      >
    </template>
  </UModal>
</template>
