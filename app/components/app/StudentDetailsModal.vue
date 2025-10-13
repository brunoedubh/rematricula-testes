<script setup lang="ts">
import type { Aluno } from '../../../types'

const props = defineProps<{
  student: Aluno | null
}>()

const emit = defineEmits<{
  close: []
  'access-environment': [environment: 'dev' | 'hml' | 'prod']
}>()

const isOpen = computed({
  get: () => !!props.student,
  set: (value) => {
    if (!value) {
      emit('close')
    }
  }
})

function closeModal() {
  console.log('[StudentDetailsModal] closeModal called')
  emit('close')
}

function handleAccessEnvironment(environment: 'dev' | 'hml' | 'prod') {
  emit('access-environment', environment)
}

// Timeline de processos
const timelineSteps = computed(() => {
  if (!props.student) return []

  return [
    {
      title: 'Registro Financeiro',
      description: 'Verificação de pendências financeiras',
      completed: props.student.IND_REG_FINANCEIRO === 'S',
      icon: 'i-heroicons-currency-dollar',
      field: 'IND_REG_FINANCEIRO'
    },
    {
      title: 'Liberação Executada',
      description: 'Sistema executou processo de liberação',
      completed: props.student.IND_EXECUTOU_LIBERACAO === 'S',
      icon: 'i-heroicons-lock-open',
      field: 'IND_EXECUTOU_LIBERACAO'
    },
    {
      title: 'Promoção Automática',
      description: 'Aluno promovido para próximo período',
      completed: props.student.IND_EXECUTOU_PROMOCAO === 'S',
      icon: 'i-heroicons-arrow-trending-up',
      field: 'IND_EXECUTOU_PROMOCAO'
    },
    {
      title: 'Contrato Liberado',
      description: 'Contrato de rematrícula disponível',
      completed: props.student.IND_CONTRATO_LIBERADO === 'S',
      icon: 'i-heroicons-document-check',
      field: 'IND_CONTRATO_LIBERADO'
    },
    {
      title: 'Oferta Confirmada',
      description: 'Oferta principal confirmada pelo aluno',
      completed: props.student.IND_CONFIRMADO_OFERTA_PRINC === 'S',
      icon: 'i-heroicons-calendar-days',
      field: 'IND_CONFIRMADO_OFERTA_PRINC'
    },
    {
      title: 'Horário Gerado',
      description: 'Grade de horários disponível',
      completed: props.student.IND_POSSUI_HORARIO === 'S',
      icon: 'i-heroicons-clock',
      field: 'IND_POSSUI_HORARIO'
    },
    {
      title: 'Contrato Liberado',
      description: 'Contrato de rematrícula disponível',
      completed: props.student.IND_CONTRATO_ASSINADO === 'S',
      icon: 'i-heroicons-document-check',
      field: 'IND_CONTRATO_ASSINADO'
    }
  ]
})

const processCompletionPercentage = computed(() => {
  if (!timelineSteps.value.length) return 0
  const completed = timelineSteps.value.filter(step => step.completed).length
  return Math.round((completed / timelineSteps.value.length) * 100)
})
</script>

<template>
  <UModal fullscreen
    v-model:open="isOpen"
    v-if="student"
  >
    <template #content>
    <UCard>
      <template #header>
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Detalhes do Aluno
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ student.NUM_MATRICULA }} - {{ student.NOM_ALUNO }}
            </p>
          </div>
          <UButton
            icon="i-heroicons-x-mark"
            variant="ghost"
            color="neutral"
            @click="closeModal"
          />
        </div>
      </template>

      <div class="space-y-6">
        <!-- Informações Gerais -->
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Informações Gerais
          </h4>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">Código:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.COD_ALUNO }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Matrícula:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.NUM_MATRICULA }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Marca:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.DSC_MARCA }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Instituição:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.SGL_INSTITUICAO }}</p>
            </div>
            <div class="col-span-2">
              <span class="text-gray-500 dark:text-gray-400">Curso:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.NOM_CURSO }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Período:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.SGL_PERIODO_LETIVO }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Tipo Persona:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.NOM_TPO_PERSONA }}</p>
            </div>
          </div>
        </div>

        <!-- Timeline de Processos -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Progresso da Rematrícula
            </h4>
            <UBadge :color="processCompletionPercentage === 100 ? 'success' : 'warning'" variant="subtle">
              {{ processCompletionPercentage }}% completo
            </UBadge>
          </div>

          <!-- Progress Bar -->
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
            <div
              class="h-2 rounded-full transition-all duration-500"
              :class="processCompletionPercentage === 100 ? 'bg-green-500' : 'bg-yellow-500'"
              :style="{ width: `${processCompletionPercentage}%` }"
            />
          </div>

          <!-- Timeline Steps -->
          <div class="relative space-y-6">
            <!-- Vertical Line -->
            <div class="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

            <div
              v-for="(step, index) in timelineSteps"
              :key="index"
              class="relative flex items-start gap-4"
            >
              <!-- Circle with Icon -->
              <div
                class="relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors"
                :class="step.completed
                  ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                  : 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'"
              >
                <UIcon
                  :name="step.completed ? 'i-heroicons-check' : step.icon"
                  :class="step.completed ? 'text-white' : 'text-gray-400 dark:text-gray-500'"
                  class="w-4 h-4"
                />
              </div>

              <!-- Content -->
              <div class="flex-1 pb-1">
                <div class="flex items-center justify-between">
                  <h5
                    class="text-sm font-medium"
                    :class="step.completed ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'"
                  >
                    {{ step.title }}
                  </h5>
                  <UBadge
                    :color="step.completed ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ step.completed ? 'Concluído' : 'Pendente' }}
                  </UBadge>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ step.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Informações Adicionais -->
        <div v-if="student.QTDE_DP_NA_MAT && student.QTDE_DP_NA_MAT > 0">
          <UAlert
            color="warning"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="Atenção"
          >
            Aluno possui {{ student.QTDE_DP_NA_MAT }} dependência(s) na matrícula
          </UAlert>
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="text-xs text-gray-500 dark:text-gray-400">
            Ofertas:
            <span v-if="student.IND_OFERTA_CORE === 'S'" class="ml-1">Core</span>
            <span v-if="student.IND_OFERTA_UCDP === 'S'" class="ml-1">UCDP</span>
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              @click="closeModal"
            >
              Fechar
            </UButton>
            <UButton
              color="primary"
              size="sm"
              @click="handleAccessEnvironment('dev')"
            >
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="mr-1" />
              Acessar DEV
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
    </template>
  </UModal>
</template>
