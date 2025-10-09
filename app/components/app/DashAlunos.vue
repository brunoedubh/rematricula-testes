<script setup lang="ts">
import type { Aluno, StudentSearchRequest } from '../../../types'
const { isLoading } = useLoadingIndicator()

const appear = ref(false)
const appeared = ref(false)
const user = ref<any>(null)
const loggingOut = ref(false)

// Página protegida automaticamente pelo middleware global

// Estado da busca de alunos
const searchForm = reactive<StudentSearchRequest>({
  studentCode: '',
  searchTerm: '',
  marca: 'Una',
  campoexemplo: '',
})

const searching = ref(false)
const searchResults = ref<Aluno[]>([])
const searchError = ref<string | null>(null)
const hasSearched = ref(false)

const exemploOptions = [
  { label: 'Una', value: 'una' },
  { label: 'Unibh', value: 'unibh' }
]

// Carregar dados do usuário
onMounted(async () => {
  try {
    const response = await $fetch('/api/auth/me') as any
    if (response && response.user) {
      user.value = response.user
    }
  } catch (error) {
    console.error('Failed to load user data:', error)
    await navigateTo('/login')
  }
})

async function handleLogout() {
  loggingOut.value = true

  try {
    await $fetch('/api/auth/logout', {
      method: 'POST'
    })

    await navigateTo('/login')
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    loggingOut.value = false
  }
}

async function searchStudents() {
  if (!searchForm.studentCode && !searchForm.searchTerm) {
    searchError.value = 'Informe pelo menos um critério de busca'
    return
  }

  searching.value = true
  searchError.value = null
  searchResults.value = []

  try {
    const response = await $fetch('/api/students/search', {
      method: 'POST',
      body: searchForm
    }) as any

    if (response.success) {
      searchResults.value = response.students
      hasSearched.value = true
    } else {
      searchError.value = response.error || 'Erro na busca de alunos'
    }
  } catch (error: any) {
    console.error('Search error:', error)
    searchError.value = error.data?.message || 'Erro interno do servidor'
  } finally {
    searching.value = false
  }
}

function clearSearch() {
  searchForm.studentCode = ''
  searchForm.searchTerm = ''
  searchForm.environment = 'dev'
  searchResults.value = []
  searchError.value = null
  hasSearched.value = false
}

function getStatusColor(status: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  switch (status?.toLowerCase()) {
    case 'ativo':
    case 'matriculado':
      return 'success'
    case 'inativo':
    case 'cancelado':
      return 'error'
    case 'suspenso':
    case 'trancado':
      return 'warning'
    default:
      return 'neutral'
  }
}
</script>

<template>
  <!-- Main Content -->
  <UContainer class="py-4 sm:py-8">
    <div class="space-y-6 sm:space-y-8">
      <!-- Bem-vindo -->
      <div class="text-center sm:text-left">
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h2>
        <p class="mt-2 text-gray-600">
          Gerencie tokens e acessos do Azure AD de forma segura
        </p>
      </div>

      <!-- Status Cards -->
      <div class="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <UCard>
          <template #header>
            <div class="flex items-center space-x-3">
              <div class="rounded-lg bg-green-100 p-2">
                <UIcon name="i-heroicons-shield-check" class="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">Autenticação</h3>
                <p class="text-sm text-gray-500">Sistema de login</p>
              </div>
            </div>
          </template>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Status</span>
              <UBadge color="success" variant="subtle">Ativo</UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Último login</span>
              <span class="text-sm text-gray-900">Agora</span>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center space-x-3">
              <div class="rounded-lg bg-blue-100 p-2">
                <UIcon name="i-heroicons-database" class="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">Databricks</h3>
                <p class="text-sm text-gray-500">Busca de alunos</p>
              </div>
            </div>
          </template>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Status</span>
              <UBadge color="success" variant="subtle">Ativo</UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Fase</span>
              <span class="text-sm text-gray-900">3 - Concluída</span>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center space-x-3">
              <div class="rounded-lg bg-purple-100 p-2">
                <UIcon name="i-heroicons-key" class="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">Tokens Azure</h3>
                <p class="text-sm text-gray-500">Geração de tokens</p>
              </div>
            </div>
          </template>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Status</span>
              <UBadge color="warning" variant="subtle">Pendente</UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Fase</span>
              <span class="text-sm text-gray-900">4</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Busca de Alunos -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 text-gray-400" />
              <h3 class="font-semibold text-gray-900">Buscar Alunos</h3>
            </div>
            <UBadge color="success" variant="subtle">Ativo</UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UInput
              v-model="searchForm.studentCode"
              placeholder="Código do aluno"
              size="lg"
            >
              <template #leading>
                <UIcon name="i-heroicons-hashtag" class="h-4 w-4 text-gray-400" />
              </template>
            </UInput>

            <UInput
              v-model="searchForm.searchTerm"
              placeholder="Nome, email ou CPF"
              size="lg"
            >
              <template #leading>
                <UIcon name="i-heroicons-user" class="h-4 w-4 text-gray-400" />
              </template>
            </UInput>

            <USelect
              v-model="searchForm.marca"
              :options="exemploOptions"
              size="lg"
              placeholder="Marca"
            />

            <USelect
              v-model="searchForm.campoexemplo"
              :options="exemploOptions"
              size="lg"
              placeholder="Contrato"
            />

            <USelect
              v-model="searchForm.campoexemplo"
              :options="exemploOptions"
              size="lg"
              placeholder="Grade"
            />
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <UButton
              @click="searchStudents"
              :loading="searching"
              size="lg"
              color="primary"
            >
              <UIcon name="i-heroicons-magnifying-glass" class="mr-2 h-4 w-4" />
              Buscar
            </UButton>

            <UButton
              @click="clearSearch"
              variant="outline"
              size="lg"
              color="neutral"
            >
              <UIcon name="i-heroicons-x-mark" class="mr-2 h-4 w-4" />
              Limpar
            </UButton>
          </div>

          <!-- Resultados da busca -->
          <div v-if="searchResults.length > 0" class="space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-900">
                Resultados ({{ searchResults.length }})
              </h4>
              <UBadge color="success" variant="subtle">
                {{ searchResults.length }} encontrado(s)
              </UBadge>
            </div>

            <div class="grid grid-cols-1 gap-4">
              <UCard
                v-for="student in searchResults"
                :key="student.codigo_aluno"
              >
                <div class="flex items-start justify-between">
                  <div class="space-y-2">
                    <div class="flex items-center space-x-2">
                      <UBadge color="info" variant="subtle">
                        {{ student.codigo_aluno }}
                      </UBadge>
                      <span class="font-medium text-gray-900">
                        {{ student.nome_completo }}
                      </span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm text-gray-600">
                      <div>
                        <span class="font-medium">Email:</span> {{ student.email }}
                      </div>
                      <div>
                        <span class="font-medium">Curso:</span> {{ student.curso }}
                      </div>
                      <div>
                        <span class="font-medium">Status:</span>
                        <UBadge
                          :color="getStatusColor(student.status_matricula)"
                          variant="subtle"
                        >
                          {{ student.status_matricula }}
                        </UBadge>
                      </div>
                      <div>
                        <span class="font-medium">Período:</span> {{ student.periodo_atual }}
                      </div>
                    </div>
                  </div>

                  <UButton
                    variant="outline"
                    size="sm"
                    color="primary"
                  >
                    <UIcon name="i-heroicons-eye" class="mr-1 h-4 w-4" />
                    Detalhes
                  </UButton>
                </div>
              </UCard>
            </div>
          </div>

          <!-- Estado vazio -->
          <div v-else-if="hasSearched && !searching" class="text-center py-8">
            <UIcon name="i-heroicons-magnifying-glass" class="mx-auto h-12 w-12 text-gray-400" />
            <h4 class="mt-2 text-lg font-medium text-gray-900">Nenhum aluno encontrado</h4>
            <p class="mt-1 text-gray-500">Tente ajustar os critérios de busca.</p>
          </div>

          <!-- Erro na busca -->
          <UAlert
            v-if="searchError"
            color="error"
            variant="soft"
            :title="searchError"
            :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'gray', variant: 'link', padded: false }"
            @close="searchError = null"
          >
            <template #icon>
              <UIcon name="i-heroicons-exclamation-triangle" />
            </template>
          </UAlert>
        </div>
      </UCard>

      <!-- Próximas Funcionalidades -->
      <UCard>
        <template #header>
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-rocket-launch" class="h-5 w-5 text-gray-400" />
            <h3 class="font-semibold text-gray-900">Próximas Funcionalidades</h3>
          </div>
        </template>

        <div class="space-y-3">
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-green-500" />
            <span class="text-sm">✅ Sistema de autenticação individual</span>
          </div>
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-green-500" />
            <span class="text-sm">✅ Integração com Databricks</span>
          </div>
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-clock" class="h-5 w-5 text-yellow-500" />
            <span class="text-sm">🔄 Geração de tokens Azure AD</span>
          </div>
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-clock" class="h-5 w-5 text-yellow-500" />
            <span class="text-sm">🔄 Interface de busca avançada</span>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
