<script setup lang="ts">
import type { Aluno } from '../../../types'

const props = defineProps<{
  student: Aluno
}>()

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
  <UCard>
    <div class="flex items-start justify-between">
      <div class="space-y-2 flex-1">
        <div class="flex items-center space-x-2 flex-wrap">
          <UBadge color="info" variant="subtle">
            #{{ student.COD_ALUNO }}
          </UBadge>
          <span class="font-medium text-gray-900">
            {{ student.NOM_ALUNO }}
          </span>
          <UBadge color="secondary" variant="subtle">
            {{ student.DSC_MARCA }}
          </UBadge>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 text-sm text-gray-600">
          <div>
            <span class="font-medium">Matrícula:</span> {{ student.NUM_MATRICULA }}
          </div>
          <div>
            <span class="font-medium">Instituição:</span> {{ student.SGL_INSTITUICAO }}
          </div>
          <div>
            <span class="font-medium">Curso:</span> {{ student.NOM_CURSO }}
          </div>
          <div>
            <span class="font-medium">Status matrícula:</span>
            <UBadge
              :color="getStatusColor(student.DSC_STA_MATRICULA)"
              variant="subtle"
            >
              {{ student.DSC_STA_MATRICULA }}
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
</template>
