<script setup lang="ts">
import type { Aluno } from '../../../types'
import StudentCard from './StudentCard.vue'

const props = defineProps<{
  students: Aluno[]
  hasSearched: boolean
  searching: boolean
  error: string | null
}>()

const emit = defineEmits<{
  'clear-error': []
}>()

function handleClearError() {
  emit('clear-error')
}
</script>

<template>
  <div class="space-y-4">
    <!-- Resultados da busca -->
    <div v-if="students.length > 0" class="space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="font-medium text-gray-900">
          Resultados ({{ students.length }})
        </h4>
        <UBadge color="success" variant="subtle">
          {{ students.length }} encontrado(s)
        </UBadge>
      </div>

      <div class="grid grid-cols-1 gap-4">
        <StudentCard
          v-for="student in students"
          :key="student.COD_ALUNO"
          :student="student"
        />
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
      v-if="error"
      color="error"
      variant="soft"
      :title="error"
      :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'gray', variant: 'link', padded: false }"
      @close="handleClearError"
    >
      <template #icon>
        <UIcon name="i-heroicons-exclamation-triangle" />
      </template>
    </UAlert>
  </div>
</template>
