<script setup lang="ts">
import type { Aluno, StudentSearchRequest } from '../../../types'
import { useDebounceFn } from '@vueuse/core'
import SearchBar from './SearchBar.vue'
import StudentList from './StudentList.vue'

// Estado da busca de alunos
const searchForm = reactive<StudentSearchRequest>({
  studentCode: '',
  searchTerm: '',
  marca: '',
  course: '',
  status: ''
})

const searching = ref(false)
const searchResults = ref<Aluno[]>([])
const searchError = ref<string | null>(null)
const hasSearched = ref(false)

// Função de busca principal
async function performSearch() {
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

// Busca com debounce de 500ms
const debouncedSearch = useDebounceFn(performSearch, 500)

// Watcher para busca automática quando digitar (com debounce)
watch([() => searchForm.searchTerm, () => searchForm.studentCode], ([newTerm, newCode]) => {
  if (newTerm || newCode) {
    debouncedSearch()
  }
})

// Busca manual (sem debounce) ao clicar no botão
function searchStudents() {
  performSearch()
}

function clearSearch() {
  searchForm.studentCode = ''
  searchForm.searchTerm = ''
  searchForm.marca = ''
  searchForm.course = ''
  searchForm.status = ''
  searchResults.value = []
  searchError.value = null
  hasSearched.value = false
}

function clearError() {
  searchError.value = null
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
      <SearchBar
        v-model:search-form="searchForm"
        :searching="searching"
        @search="searchStudents"
        @clear="clearSearch"
      />

      <!-- Resultados da busca -->
      <StudentList
        :students="searchResults"
        :has-searched="hasSearched"
        :searching="searching"
        :error="searchError"
        @clear-error="clearError"
      />

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
