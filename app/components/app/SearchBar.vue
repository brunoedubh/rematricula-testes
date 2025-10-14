<script setup lang="ts">
import type { StudentSearchRequest } from '../../../types'
import type { SelectItem } from '@nuxt/ui'

const props = defineProps<{
  searching: boolean
}>()

const emit = defineEmits<{
  search: []
  clear: []
  'update:searchForm': [value: StudentSearchRequest]
}>()

const searchForm = defineModel<StudentSearchRequest>('searchForm', { required: true })

const marcaOptions = ref<SelectItem[]>([
  { label: 'UNIBH', value: '1' },
  { label: 'UNA', value: '2' },
  { label: 'São Judas', value: '3' },
  { label: 'SOCIESC', value: '4' },
  { label: 'AGES', value: '8' },
  { label: 'FASEH', value: '11' },
  { label: 'UNIFG', value: '12' },
  { label: 'Unisul', value: '13' },
  { label: 'UAM', value: '18' },
  { label: 'MCampos', value: '24' },
  { label: 'UNIFGUA', value: '26' },
  { label: 'FPB', value: '27' },
  { label: 'IBCMED', value: '28' },
  { label: 'CEDEPE', value: '29' },
  { label: 'BSP', value: '30' }
])

const personaOptions = ref<SelectItem[]>([
  { label: 'Maria Eduarda', value: '5' },
  { label: 'João Pedro', value: '8' },
  { label: 'Vera Lucia', value: '7' },
  { label: 'Maria Luiza', value: '10' },
  { label: 'Ricardo', value: '1' },
  { label: 'Julio Cesar', value: '6' }
])

const gradeOptions = ref<SelectItem[]>([
  { label: 'E2A 2.0', value: '5' },
  { label: 'E2A 1.0', value: '2' },
  { label: 'Grades Antigas', value: '3' },
  { label: 'E2A Radial', value: '11' }
])

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
          v-model="searchForm.studentRA"
          placeholder="RA"
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
          :items="marcaOptions"
          size="lg"
          placeholder="Marca"
          clearable
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

        <USelect
          v-model="searchForm.categoriaGrade"
          :items="gradeOptions"
          size="lg"
          placeholder="Categoria Grade"
          clearable
        />

        <USelect
          v-model="searchForm.persona"
          :items="personaOptions"
          size="lg"
          placeholder="Persona"
          clearable
        />
        <UCheckbox v-model="searchForm.IND_CONTRATO_ASSINADO" size="lg" color="primary" label="Contrato Assinado" />
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
