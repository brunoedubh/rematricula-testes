<script setup lang="ts">
import type { Aluno, StudentSearchRequest } from '../../../types'
import { useDebounceFn } from '@vueuse/core'
import SearchBar from './SearchBar.vue'
import StudentList from './StudentList.vue'
import TokenStatusCard from './TokenStatusCard.vue'
import StudentDetailsModal from './StudentDetailsModal.vue'
import ProductionAccessModal from './ProductionAccessModal.vue'

// Estado da busca de alunos
const searchForm = reactive<StudentSearchRequest>({
  studentCode: '',
  studentRA: '',
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
  if (!searchForm.studentCode && !searchForm.searchTerm && !searchForm.studentRA && !searchForm.course && !searchForm.marca) {
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
  searchForm.studentRA = ''
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

// Estado dos modais
const selectedStudent = ref<Aluno | null>(null)
const selectedStudentForDetails = ref<Aluno | null>(null)
const selectedStudentForProduction = ref<Aluno | null>(null)
const pendingEnvironment = ref<'dev' | 'hml' | 'prod' | null>(null)

// Toast notifications
const toast = useToast()

function handleViewDetails(student: Aluno) {
  console.log('[DashAlunos] handleViewDetails called with:', student)
  selectedStudentForDetails.value = student
  console.log('[DashAlunos] selectedStudentForDetails set to:', selectedStudentForDetails.value)
}

function handleAccessEnvironment(environment: 'dev' | 'hml' | 'prod', student: Aluno) {
  console.log('[DashAlunos] handleAccessEnvironment called with:', environment, student)
  selectedStudent.value = student
  pendingEnvironment.value = environment

  if (environment === 'prod') {
    console.log('[DashAlunos] Opening production modal')
    // Abrir modal de confirmação para produção
    selectedStudentForProduction.value = student
    console.log('[DashAlunos] selectedStudentForProduction set to:', selectedStudentForProduction.value)
  } else {
    console.log('[DashAlunos] Generating URL for', environment)
    // Para dev/hml, gerar URL diretamente
    generateAccessUrl(environment, student, undefined)
  }
}

async function generateAccessUrl(
  environment: 'dev' | 'hml' | 'prod',
  student: Aluno,
  password?: string
) {
  try {
    const response = await $fetch('/api/tokens/generate-url', {
      method: 'POST',
      body: {
        environment,
        studentCode: student.COD_ALUNO.toString(),
        password
      }
    }) as any

    if (response.success && response.url) {
      // Abrir URL em nova aba
      window.open(response.url, '_blank')

      // Notificação de sucesso
      if (response.from_cache) {
        toast.add({
          title: 'Token do Cache',
          description: `Usando token em cache para ${environment.toUpperCase()}`,
          icon: 'i-heroicons-clock',
          color: 'blue'
        })
      } else {
        toast.add({
          title: 'Novo Token Gerado',
          description: `Token gerado com sucesso para ${environment.toUpperCase()}`,
          icon: 'i-heroicons-check-circle',
          color: 'green'
        })
      }

      // Fechar modal de produção se estava aberto
      if (environment === 'prod') {
        selectedStudentForProduction.value = null
      }
    }
  } catch (error: any) {
    console.error('Error generating URL:', error)
    toast.add({
      title: 'Erro ao gerar acesso',
      description: error.data?.message || 'Erro ao gerar URL de acesso',
      icon: 'i-heroicons-exclamation-triangle',
      color: 'red'
    })
  } finally {
    selectedStudent.value = null
    pendingEnvironment.value = null
  }
}

function handleProductionConfirm(password: string) {
  if (selectedStudentForProduction.value) {
    generateAccessUrl('prod', selectedStudentForProduction.value, password)
  }
}

function closeDetailsModal() {
  selectedStudentForDetails.value = null
}

function closeProductionModal() {
  selectedStudentForProduction.value = null
  selectedStudent.value = null
  pendingEnvironment.value = null
}

function handleAccessEnvironmentFromDetails(environment: 'dev' | 'hml' | 'prod') {
  if (selectedStudentForDetails.value) {
    // Fechar modal de detalhes
    closeDetailsModal()
    // Abrir fluxo de acesso
    handleAccessEnvironment(environment, selectedStudentForDetails.value)
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
        @view-details="handleViewDetails"
        @access-environment="handleAccessEnvironment"
      />

      <!-- Status Cards -->
      <div class="grid grid-cols-1 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-2">
        <UCard>
          <template #header>
            <div class="flex items-center space-x-3">
              <div class="rounded-lg bg-blue-100 p-2">
                <UIcon name="i-heroicons-circle-stack" class="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">Databricks</h3>
                <p class="text-sm text-gray-500">Status atualização</p>
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Status</span>
              <UBadge color="success" variant="subtle">Ativo</UBadge>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Frequencia de atualização</span>
              <span class="text-sm text-gray-900">Diário | D-1 com SIAF</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">Data atualização</span>
              <span class="text-sm text-gray-900">22/08/2025</span>
            </div>
          </div>
        </UCard>

        <TokenStatusCard />
      </div>

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
            <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-green-500" />
            <span class="text-sm">✅ Sistema de tokens com cache</span>
          </div>
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-clock" class="h-5 w-5 text-yellow-500" />
            <span class="text-sm">✅ Botões de acesso por ambiente</span>
          </div>
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-clock" class="h-5 w-5 text-yellow-500" />
            <span class="text-sm">✅ Modal de confirmação para produção</span>
          </div>
          <div class="flex items-center space-x-3">
            <UIcon name="i-heroicons-clock" class="h-5 w-5 text-yellow-500" />
            <span class="text-sm">🔄 Remover bloqueio softlaunch</span>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>

  <!-- Modais -->
  <StudentDetailsModal
    :student="selectedStudentForDetails"
    @close="closeDetailsModal"
    @access-environment="handleAccessEnvironmentFromDetails"
  />

  <ProductionAccessModal
    :student="selectedStudentForProduction"
    @close="closeProductionModal"
    @confirm="handleProductionConfirm"
  />
</template>
