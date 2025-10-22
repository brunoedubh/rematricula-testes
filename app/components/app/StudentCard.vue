<script setup lang="ts">
import type { Aluno } from '../../../types'

const props = defineProps<{
  student: Aluno
}>()

const emit = defineEmits<{
  'view-details': [student: Aluno]
  'access-environment': [environment: 'dev' | 'hml' | 'prod', student: Aluno]
}>()

const loadingEnvironment = ref<'dev' | 'hml' | 'prod' | null>(null)

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

function handleViewDetails() {
  console.log('[StudentCard] handleViewDetails called, emitting view-details')
  emit('view-details', props.student)
}

async function handleAccessEnvironment(environment: 'dev' | 'hml' | 'prod') {
  console.log('[StudentCard] handleAccessEnvironment called with:', environment)
  loadingEnvironment.value = environment
  emit('access-environment', environment, props.student)
  console.log('[StudentCard] emitted access-environment')

  // Reset loading após 5 segundos (fallback caso o parent não resete)
  setTimeout(() => {
    loadingEnvironment.value = null
  }, 5000)
}

// Watch para resetar loading quando o ambiente mudar
watch(() => props.student, () => {
  loadingEnvironment.value = null
})
</script>

<template>
  <UCard>
    <div class="flex items-start justify-between">
      <div class="space-y-2 flex-1">
        <div class="flex items-center space-x-2 flex-wrap">
          <UBadge color="neutral" variant="subtle">
            #{{ student.COD_ALUNO }}
          </UBadge>
          <span class="font-medium text-gray-900">
            {{ student.NUM_MATRICULA }} - {{ student.NOM_ALUNO }}
          </span>
          
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-4 text-sm text-gray-600">
          <div>
            <span class="font-medium">Marca:</span> {{ student.DSC_MARCA }}
          </div>
          <div>
            <span class="font-medium">Curso:</span> {{ student.NOM_CURSO }}
          </div>
          <div v-if="student.IND_CALOURO == 'S'">
            <UBadge color="success" variant="subtle">
              <UIcon name="i-heroicons-arrow-right-circle" class="mr-1 h-3 w-3" />
              Calouro
            </UBadge>
          </div>
          <div v-else>
            <UBadge color="info" variant="subtle">
              <UIcon name="i-heroicons-academic-cap" class="mr-1 h-3 w-3" />
              Veterano
            </UBadge>
          </div>
          <div>
            <span class="font-medium">Categoria grade:</span>
            <UBadge
              :color="getStatusColor(student.DSC_STA_MATRICULA)"
              variant="subtle"
            >
              {{ student.DSC_CATEGORIA_GRADE }}
            </UBadge>
          </div>
          <div>
            <span class="font-medium">Período:</span> {{ student.SGL_PERIODO_LETIVO }}
          </div>
          <div v-if="student.IND_CONTRATO_LIBERADO">
            <UBadge color="success" variant="subtle">
              <UIcon name="i-heroicons-check-circle" class="mr-1 h-3 w-3" />
              Contrato Liberado
            </UBadge>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <UButton
          variant="outline"
          size="sm"
          color="primary"
          @click="handleViewDetails"
        >
          <UIcon name="i-heroicons-eye" class="mr-1 h-4 w-4" />
          Detalhes
        </UButton>

        <div class="flex gap-1">
          <UButton
            variant="soft"
            size="xs"
            color="blue"
            :loading="loadingEnvironment === 'dev'"
            @click="handleAccessEnvironment('dev')"
          >
            DEV
          </UButton>
          <UButton
            variant="soft"
            size="xs"
            color="yellow"
            :loading="loadingEnvironment === 'hml'"
            @click="handleAccessEnvironment('hml')"
          >
            HML
          </UButton>
          <UButton
            variant="soft"
            size="xs"
            color="red"
            :loading="loadingEnvironment === 'prod'"
            @click="handleAccessEnvironment('prod')"
          >
            PROD
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
