<script setup lang="ts">
import type { Aluno } from '../../../types'

const props = defineProps<{
  student: Aluno | null
}>()

const emit = defineEmits<{
  close: []
  'access-environment': [environment: 'dev' | 'hml' | 'prod', student: Aluno]
  'student-unlocked': []
}>()

const isOpen = computed({
  get: () => !!props.student,
  set: (value) => {
    if (!value) {
      emit('close')
    }
  }
})

const toast = useToast()
const isUnlocking = ref(false)
const loadingBlockStatus = ref(false)
const blockStatus = ref<{ bloqueado: boolean; dataFimBloqueio?: string } | null>(null)

const loadingEnvironment = ref<'dev' | 'hml' | 'prod' | null>(null)

// Buscar status de bloqueio quando o modal abrir
watch(() => props.student, async (newStudent) => {
  if (newStudent) {
    await fetchBlockStatus()
  } else {
    // Limpar status quando fechar
    blockStatus.value = null
  }
}, { immediate: true })

async function fetchBlockStatus() {
  if (!props.student) return

  try {
    loadingBlockStatus.value = true

    const response = await $fetch('/api/students/block-status', {
      method: 'POST',
      body: {
        codigocurso: props.student.COD_CURSO,
        identificadorpersona: props.student.COD_TPO_PERSONA,
        codigocampus: props.student.COD_CAMPUS,
        codigoperiodoletivo: props.student.COD_PERIODO_LETIVO
      }
    })

    if (response.success) {
      blockStatus.value = {
        bloqueado: response.bloqueado || false,
        dataFimBloqueio: response.dataFimBloqueio
      }
    }
  } catch (error: any) {
    console.error('Erro ao buscar status de bloqueio:', error)
    // Em caso de erro, assumir bloqueado por segurança
    blockStatus.value = { bloqueado: true }
  } finally {
    loadingBlockStatus.value = false
  }
}

function closeModal() {
  console.log('[StudentDetailsModal] closeModal called')
  emit('close')
}

async function handleAccessEnvironment(environment: 'dev' | 'hml' | 'prod') {
  if (!props.student) {
    console.error('[StudentDetailsModal] Cannot access environment: student is null')
    return
  }

  console.log('[StudentDetailsModal] handleAccessEnvironment called with:', environment)
  loadingEnvironment.value = environment
  emit('access-environment', environment, props.student)
  console.log('[StudentDetailsModal] emitted access-environment')

  // Reset loading após 5 segundos (fallback caso o parent não resete)
  setTimeout(() => {
    loadingEnvironment.value = null
  }, 5000)
}

async function handleLiberarAluno() {
  if (!props.student) return

  try {
    isUnlocking.value = true

    const response = await $fetch('/api/students/liberar', {
      method: 'POST',
      body: {
        codigocurso: props.student.COD_CURSO,
        identificadorpersona: props.student.COD_TPO_PERSONA,
        codigocampus: props.student.COD_CAMPUS,
        codigoperiodoletivo: props.student.COD_PERIODO_LETIVO
      }
    })

    if (response.success) {
      toast.add({
        title: 'Sucesso',
        description: response.message,
        color: 'success'
      })
      // Recarregar status de bloqueio
      await fetchBlockStatus()
      emit('student-unlocked')
    } else {
      toast.add({
        title: 'Erro',
        description: response.message || 'Erro ao liberar aluno',
        color: 'error'
      })
    }
  } catch (error: any) {
    console.error('Erro ao liberar aluno:', error)
    toast.add({
      title: 'Erro',
      description: error.message || 'Erro ao liberar aluno',
      color: 'error'
    })
  } finally {
    isUnlocking.value = false
  }
}

async function handleEncerrarLiberacao() {
  if (!props.student) return

  try {
    isUnlocking.value = true

    const response = await $fetch('/api/students/unlock', {
      method: 'POST',
      body: {
        codigocurso: props.student.COD_CURSO,
        identificadorpersona: props.student.COD_TPO_PERSONA,
        codigocampus: props.student.COD_CAMPUS,
        codigoperiodoletivo: props.student.COD_PERIODO_LETIVO
      }
    })

    if (response.success) {
      toast.add({
        title: 'Sucesso',
        description: response.message,
        color: 'success'
      })
      // Recarregar status de bloqueio
      await fetchBlockStatus()
      emit('student-unlocked')
    } else {
      toast.add({
        title: 'Erro',
        description: response.message || 'Erro ao encerrar liberação',
        color: 'error'
      })
    }
  } catch (error: any) {
    console.error('Erro ao encerrar liberação:', error)
    toast.add({
      title: 'Erro',
      description: error.message || 'Erro ao encerrar liberação',
      color: 'error'
    })
  } finally {
    isUnlocking.value = false
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Steps para o Stepper
const stepperItems = computed(() => {
  if (!props.student) return []

  return [
    {
      label: 'Reg. Financeiro',
      description: 'Pendências financeiras',
      status: props.student.IND_REG_FINANCEIRO === 'S' ? 'complete' : 'incomplete',
      icon: 'i-heroicons-currency-dollar'
    },
    {
      label: 'Liberação',
      description: 'Processo executado',
      status: props.student.IND_EXECUTOU_LIBERACAO === 'S' ? 'complete' : 'incomplete',
      icon: 'i-heroicons-lock-open'
    },
    {
      label: 'Promoção',
      description: 'Próximo período',
      status: props.student.IND_EXECUTOU_PROMOCAO === 'S' ? 'complete' : 'incomplete',
      icon: 'i-heroicons-arrow-trending-up'
    },
    {
      label: 'Contrato',
      description: 'Disponível',
      status: props.student.IND_CONTRATO_LIBERADO === 'S' ? 'complete' : 'incomplete',
      icon: 'i-heroicons-document-check'
    },
    {
      label: 'Oferta',
      description: 'Confirmada',
      status: props.student.IND_CONFIRMADO_OFERTA_PRINC === 'S' ? 'complete' : 'incomplete',
      icon: 'i-heroicons-calendar-days'
    },
    {
      label: 'Horário',
      description: 'Possui Horário',
      status: props.student.IND_POSSUI_HORARIO === 'S' ? 'complete' : 'incomplete',
      icon: 'i-heroicons-clock'
    },
    {
      label: 'Assinatura',
      description: 'Contrato assinado',
      status: props.student.IND_CONTRATO_ASSINADO === true ? 'complete' : 'incomplete',
      icon: 'i-heroicons-document-check'
    }
  ]
})

const processCompletionPercentage = computed(() => {
  if (!stepperItems.value.length) return 0
  const completed = stepperItems.value.filter(step => step.status === 'complete').length
  return Math.round((completed / stepperItems.value.length) * 100)
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
        <!-- Status de Soft Launch -->
        

        <!-- Informações Gerais -->
        <div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Informações Gerais            
          </h4>         
          
          <div class="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">Código Aluno:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.COD_ALUNO }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Matrícula:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.NUM_MATRICULA }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">CPF:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.NUM_CPF }}</p>
            </div>
            
            <div>
              <span class="text-gray-500 dark:text-gray-400">Marca/Instituição:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.DSC_MARCA }} / {{ student.SGL_INSTITUICAO }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Curso:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.NOM_CURSO }}</p>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">Categoria Grade:</span>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ student.DSC_CATEGORIA_GRADE }}</p>
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

        <div class="grid grid-cols-1 gap-3 text-sm">
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
        </div>

        

        <!-- Stepper de Processos -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Progresso da Rematrícula
            </h4>
            <UBadge :color="processCompletionPercentage === 100 ? 'success' : 'warning'" variant="subtle">
              {{ processCompletionPercentage }}% completo
            </UBadge>
          </div>

          <!-- Stepper Horizontal (Estático) -->
          <div class="relative flex items-start justify-between gap-2 overflow-x-auto pb-2">
            <div
              v-for="(item, index) in stepperItems"
              :key="index"
              class="flex flex-col items-center text-center gap-2 min-w-[80px] flex-1"
            >
              <!-- Círculo do step -->
              <div class="relative z-10">
                <!-- Linha conectora à direita -->
                <div
                  v-if="index < stepperItems.length - 1"
                  class="absolute top-1/2 left-[50px] w-[calc(100vw/7-60px)] h-0.5 -translate-y-1/2"
                  :class="item.status === 'complete' ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-300 dark:bg-gray-600'"
                />

                <div
                  class="relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors"
                  :class="item.status === 'complete'
                    ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                    : 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'"
                >
                  <UIcon
                    :name="item.status === 'complete' ? 'i-heroicons-check' : item.icon"
                    :class="item.status === 'complete' ? 'text-white' : 'text-gray-400 dark:text-gray-500'"
                    class="w-5 h-5"
                  />
                </div>
              </div>

              <!-- Labels -->
              <div class="min-w-0 w-full">
                <p
                  class="text-xs font-medium truncate"
                  :class="item.status === 'complete' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'"
                >
                  {{ item.label }}
                </p>
                <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="loadingBlockStatus">
          <UAlert
            color="info"
            variant="soft"
            icon="i-heroicons-arrow-path"
            title="Carregando status de bloqueio..."
          />
        </div>
        <div v-else-if="blockStatus">
          <UAlert
            :color="blockStatus.bloqueado ? 'error' : 'success'"
            variant="soft"
            :icon="blockStatus.bloqueado ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'"
            :title="blockStatus.bloqueado ? 'Aluno Bloqueado (Fora do Soft Launch)' : 'Aluno Liberado (Soft Launch Ativo)'"
          >
            <template #description>
              <div v-if="blockStatus.bloqueado">
                <p class="mb-2">Este aluno não está liberado para o soft launch. Não possui acesso ao sistema de rematrícula.</p>
                <UButton
                  color="success"
                  variant="soft"
                  size="xs"
                  :loading="isUnlocking"
                  @click="handleLiberarAluno"
                >
                  <UIcon name="i-heroicons-lock-open" class="mr-1" />
                  Liberar Aluno (1 dia)
                </UButton>
              </div>
              <div v-else-if="!blockStatus.bloqueado && blockStatus.dataFimBloqueio">
                <p class="mb-2">Este aluno está liberado no soft launch até {{ formatDate(blockStatus.dataFimBloqueio) }}</p>
                <UButton
                  color="warning"
                  variant="soft"
                  size="xs"
                  :loading="isUnlocking"
                  @click="handleEncerrarLiberacao"
                >
                  <UIcon name="i-heroicons-x-circle" class="mr-1" />
                  Encerrar Liberação (Bloquear após hoje)
                </UButton>
              </div>
            </template>
          </UAlert>
        </div>

      </div>
      <template #footer>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div class="text-xs text-gray-500 dark:text-gray-400">
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
            <UButton
              color="primary"
              size="sm"
              @click="handleAccessEnvironment('hml')"
            >
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="mr-1" />
              Acessar HML
            </UButton>
            <UButton
              color="primary"
              size="sm"
              @click="handleAccessEnvironment('prod')"
            >
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="mr-1" />
              Acessar PROD
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
    </template>
  </UModal>
</template>
