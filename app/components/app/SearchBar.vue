<script setup lang="ts">
import type { StudentSearchRequest } from '../../../types'

const props = defineProps<{
  searching: boolean
}>()

const emit = defineEmits<{
  search: []
  clear: []
  'update:searchForm': [value: StudentSearchRequest]
}>()

const searchForm = defineModel<StudentSearchRequest>('searchForm', { required: true })

const marcaOptions = [
  { label: 'Todas', value: '' },
  { label: 'Una', value: 'Una' },
  { label: 'Unibh', value: 'Unibh' },
  { label: 'São Judas', value: 'São Judas' },
  { label: 'UniFG', value: 'UniFG' }
]

function handleSearch() {
  emit('search')
}

function handleClear() {
  emit('clear')
}
</script>

<template>
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
          :options="marcaOptions"
          size="lg"
          placeholder="Marca"
        />

        <UInput
          v-model="searchForm.course"
          placeholder="Curso"
          size="lg"
        >
          <template #leading>
            <UIcon name="i-heroicons-academic-cap" class="h-4 w-4 text-gray-400" />
          </template>
        </UInput>

        <UInput
          v-model="searchForm.status"
          placeholder="Status"
          size="lg"
        >
          <template #leading>
            <UIcon name="i-heroicons-check-badge" class="h-4 w-4 text-gray-400" />
          </template>
        </UInput>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
        <UButton
          @click="handleSearch"
          :loading="searching"
          size="lg"
          color="primary"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="mr-2 h-4 w-4" />
          Buscar
        </UButton>

        <UButton
          @click="handleClear"
          variant="outline"
          size="lg"
          color="neutral"
        >
          <UIcon name="i-heroicons-x-mark" class="mr-2 h-4 w-4" />
          Limpar
        </UButton>
      </div>
    </div>
  </UCard>
</template>
