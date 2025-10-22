<script setup lang="ts">
import type { Aluno } from '../../../types'

const props = defineProps<{
  student: Aluno | null
  environment: 'dev' | 'hml' | 'prod' | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [password: string]
}>()

const password = ref('')
const showPassword = ref(false)
const error = ref<string | null>(null)

const isOpen = computed({
  get: () => !!props.student && !!props.environment,
  set: (value) => {
    if (!value) {
      closeModal()
    }
  }
})

const environmentLabel = computed(() => {
  if (!props.environment) return ''
  const labels = {
    dev: 'Desenvolvimento',
    hml: 'Homologação',
    prod: 'Produção'
  }
  return labels[props.environment]
})

function closeModal() {
  password.value = ''
  showPassword.value = false
  error.value = null
  emit('close')
}

function handleConfirm() {
  if (!password.value) {
    error.value = 'Por favor, informe sua senha'
    return
  }

  error.value = null
  emit('confirm', password.value)
  password.value = ''
  showPassword.value = false
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    v-if="student && environment"
  >
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3">
              <div class="rounded-lg bg-yellow-100 dark:bg-yellow-900/20 p-2">
                <UIcon name="i-heroicons-lock-closed" class="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Sessão Expirada
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Autenticação necessária
                </p>
              </div>
            </div>
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="neutral"
              @click="closeModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <!-- Alerta de Informação -->
          <UAlert
            color="info"
            variant="soft"
            icon="i-heroicons-information-circle"
            title="Reautenticação Necessária"
          >
            Sua sessão expirou. Por favor, informe sua senha para continuar.
          </UAlert>

          <!-- Informações do Acesso -->
          <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Detalhes do Acesso
            </h4>
            <div class="space-y-1 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">Aluno:</span>
                <span class="ml-2 font-medium text-gray-900 dark:text-gray-100">{{ student.NOM_ALUNO }}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400">Ambiente:</span>
                <span class="ml-2 font-medium text-gray-900 dark:text-gray-100">{{ environmentLabel }}</span>
              </div>
            </div>
          </div>

          <!-- Campo de Senha -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Digite sua senha para continuar
            </label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Digite sua senha"
                class="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                @keyup.enter="handleConfirm"
                autofocus
              >
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                @click="showPassword = !showPassword"
              >
                <UIcon
                  :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                  class="h-5 w-5"
                />
              </button>
            </div>
            <p v-if="error" class="text-sm text-red-600 dark:text-red-400">
              {{ error }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Sua senha será usada para gerar um novo token de acesso
            </p>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-end gap-3">
            <UButton
              color="neutral"
              variant="outline"
              @click="closeModal"
            >
              Cancelar
            </UButton>
            <UButton
              color="primary"
              @click="handleConfirm"
            >
              <UIcon name="i-heroicons-arrow-right-circle" class="mr-2" />
              Continuar
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
