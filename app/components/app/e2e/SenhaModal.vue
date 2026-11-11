<script setup lang="ts">
/** Senha para gerar o token de HML quando a sessão não a tem (mesma regra do /api/tokens/generate-url). */
const props = defineProps<{ aberto: boolean }>()
const emit = defineEmits<{ responder: [senha: string | null] }>()

const senha = ref('')
const mostrar = ref(false)

const open = computed({
  get: () => props.aberto,
  set: (v) => {
    if (!v) cancelar()
  }
})

function cancelar() {
  senha.value = ''
  emit('responder', null)
}

function confirmar() {
  if (!senha.value) return
  const s = senha.value
  senha.value = ''
  emit('responder', s)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Senha necessária"
    description="A esteira gera um token de HML com a sua conta. Informe a senha para continuar."
  >
    <template #body>
      <UFormField label="Senha">
        <UInput
          v-model="senha"
          :type="mostrar ? 'text' : 'password'"
          class="w-full"
          autofocus
          @keyup.enter="confirmar"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              :icon="mostrar ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="mostrar ? 'Ocultar senha' : 'Mostrar senha'"
              @click="() => { mostrar = !mostrar }"
            />
          </template>
        </UInput>
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="cancelar">
          Cancelar
        </UButton>
        <UButton :disabled="!senha" @click="confirmar">
          Continuar
        </UButton>
      </div>
    </template>
  </UModal>
</template>
