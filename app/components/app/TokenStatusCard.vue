<script setup lang="ts">
const loading = ref(false)
const tokensStatus = ref<{
  dev: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
  hml: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
  prod: { exists: boolean; expiresAt?: number; minutesRemaining?: number }
} | null>(null)

// Carregar status dos tokens
async function loadTokensStatus() {
  loading.value = true
  try {
    const response = await $fetch('/api/tokens/status') as any
    if (response.success && response.tokens) {
      tokensStatus.value = response.tokens
    }
  } catch (error) {
    console.error('Failed to load tokens status:', error)
  } finally {
    loading.value = false
  }
}

// Carregar ao montar e configurar atualização automática
onMounted(() => {
  loadTokensStatus()

  // Atualizar a cada 30 segundos (apenas no cliente)
  const interval = setInterval(() => {
    loadTokensStatus()
  }, 30000)

  // Limpar interval ao desmontar
  onUnmounted(() => {
    clearInterval(interval)
  })
})

function getStatusColor(exists: boolean, minutesRemaining?: number): 'success' | 'warning' | 'neutral' {
  if (!exists) return 'neutral'
  if (minutesRemaining && minutesRemaining < 10) return 'warning'
  return 'success'
}

function getStatusIcon(exists: boolean, minutesRemaining?: number): string {
  if (!exists) return 'i-heroicons-x-circle'
  if (minutesRemaining && minutesRemaining < 10) return 'i-heroicons-exclamation-triangle'
  return 'i-heroicons-check-circle'
}

function formatTimeRemaining(minutesRemaining?: number): string {
  if (!minutesRemaining || minutesRemaining <= 0) return 'Expirado'
  if (minutesRemaining < 60) return `${minutesRemaining}min`
  const hours = Math.floor(minutesRemaining / 60)
  const mins = minutesRemaining % 60
  return `${hours}h ${mins}min`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="rounded-lg bg-purple-100 dark:bg-purple-900/20 p-2">
            <UIcon name="i-heroicons-key" class="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">Tokens Azure AD</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Status dos tokens em cache</p>
          </div>
        </div>
        <UButton
          icon="i-heroicons-arrow-path"
          variant="ghost"
          color="neutral"
          size="sm"
          :loading="loading"
          @click="loadTokensStatus"
        />
      </div>
    </template>

    <div v-if="loading && !tokensStatus" class="flex items-center justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 text-gray-400 animate-spin" />
    </div>

    <div v-else-if="tokensStatus" class="space-y-3">
      <!-- DEV -->
      <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <div class="flex items-center space-x-3">
          <UIcon
            :name="getStatusIcon(tokensStatus.dev.exists, tokensStatus.dev.minutesRemaining)"
            :class="[
              'h-5 w-5',
              getStatusColor(tokensStatus.dev.exists, tokensStatus.dev.minutesRemaining) === 'success' ? 'text-green-500' :
              getStatusColor(tokensStatus.dev.exists, tokensStatus.dev.minutesRemaining) === 'warning' ? 'text-yellow-500' :
              'text-gray-400'
            ]"
          />
          <div>
            <div class="font-medium text-gray-900 dark:text-gray-100">DEV</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ tokensStatus.dev.exists ? 'Token ativo' : 'Sem token' }}
            </div>
          </div>
        </div>
        <div class="text-right">
          <UBadge
            :color="getStatusColor(tokensStatus.dev.exists, tokensStatus.dev.minutesRemaining)"
            variant="subtle"
          >
            {{ tokensStatus.dev.exists ? formatTimeRemaining(tokensStatus.dev.minutesRemaining) : 'Não gerado' }}
          </UBadge>
        </div>
      </div>

      <!-- HML -->
      <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <div class="flex items-center space-x-3">
          <UIcon
            :name="getStatusIcon(tokensStatus.hml.exists, tokensStatus.hml.minutesRemaining)"
            :class="[
              'h-5 w-5',
              getStatusColor(tokensStatus.hml.exists, tokensStatus.hml.minutesRemaining) === 'success' ? 'text-green-500' :
              getStatusColor(tokensStatus.hml.exists, tokensStatus.hml.minutesRemaining) === 'warning' ? 'text-yellow-500' :
              'text-gray-400'
            ]"
          />
          <div>
            <div class="font-medium text-gray-900 dark:text-gray-100">HML</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ tokensStatus.hml.exists ? 'Token ativo' : 'Sem token' }}
            </div>
          </div>
        </div>
        <div class="text-right">
          <UBadge
            :color="getStatusColor(tokensStatus.hml.exists, tokensStatus.hml.minutesRemaining)"
            variant="subtle"
          >
            {{ tokensStatus.hml.exists ? formatTimeRemaining(tokensStatus.hml.minutesRemaining) : 'Não gerado' }}
          </UBadge>
        </div>
      </div>

      <!-- PROD -->
      <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
        <div class="flex items-center space-x-3">
          <UIcon
            :name="getStatusIcon(tokensStatus.prod.exists, tokensStatus.prod.minutesRemaining)"
            :class="[
              'h-5 w-5',
              getStatusColor(tokensStatus.prod.exists, tokensStatus.prod.minutesRemaining) === 'success' ? 'text-green-500' :
              getStatusColor(tokensStatus.prod.exists, tokensStatus.prod.minutesRemaining) === 'warning' ? 'text-yellow-500' :
              'text-gray-400'
            ]"
          />
          <div>
            <div class="font-medium text-gray-900 dark:text-gray-100">PROD</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ tokensStatus.prod.exists ? 'Token ativo' : 'Gerado sob demanda' }}
            </div>
          </div>
        </div>
        <div class="text-right">
          <UBadge
            :color="getStatusColor(tokensStatus.prod.exists, tokensStatus.prod.minutesRemaining)"
            variant="subtle"
          >
            {{ tokensStatus.prod.exists ? formatTimeRemaining(tokensStatus.prod.minutesRemaining) : 'Requer senha' }}
          </UBadge>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="text-xs text-gray-500 dark:text-gray-400">
        <UIcon name="i-heroicons-information-circle" class="inline h-3 w-3 mr-1" />
        Tokens são gerados automaticamente no login (DEV/HML) ou sob demanda (PROD)
      </div>
    </template>
  </UCard>
</template>
