<script setup lang="ts">
import type { ResumoPendencias, TipoPendencia, AlunoComPendencias } from '~/types'

// ── State ──────────────────────────────────────────────────────────────────
const searchAluno = ref('')
const lastUpdated = ref<string | null>(null)
const refreshing = ref(false)
const showAllTipos = ref(false)
const activeFilter = ref(0)
const tabelaRef = ref<HTMLElement | null>(null)

// ── Data fetching ──────────────────────────────────────────────────────────
const { data: resumoRaw, pending: loadingResumo, refresh: refreshResumo } =
  useFetch<any>('/api/pendencias/resumo')

const { data: tiposRaw, pending: loadingTipos, refresh: refreshTipos } =
  useFetch<any>('/api/pendencias/por-tipo')

const { data: alunosRaw, pending: loadingAlunos, refresh: refreshAlunos } =
  useFetch<any>('/api/pendencias/alunos')

// ── Computed data ──────────────────────────────────────────────────────────
const resumo = computed<ResumoPendencias>(() =>
  resumoRaw.value?.data ?? {
    total_aptos: 0,
    total_com_pendencias: 0,
    total_pendencias_ativas: 0,
    percentual_pendentes: 0
  }
)

const tipos = computed<TipoPendencia[]>(() => tiposRaw.value?.data ?? [])
const alunos = computed<AlunoComPendencias[]>(() => alunosRaw.value?.data ?? [])

const loading = computed(() => loadingResumo.value || loadingTipos.value || loadingAlunos.value)

const hasError = computed(() =>
  resumoRaw.value?.success === false ||
  tiposRaw.value?.success === false ||
  alunosRaw.value?.success === false
)

const errorMessage = computed(() =>
  resumoRaw.value?.error || tiposRaw.value?.error || alunosRaw.value?.error || ''
)

// ── Derived stats ──────────────────────────────────────────────────────────
const semPendencias = computed(() =>
  Math.max(0, resumo.value.total_aptos - resumo.value.total_com_pendencias)
)

const pctPendentes = computed(() =>
  resumo.value.total_aptos > 0
    ? Math.round((resumo.value.total_com_pendencias / resumo.value.total_aptos) * 1000) / 10
    : 0
)

const pctResolvido = computed(() =>
  Math.max(0, Math.round((100 - pctPendentes.value) * 10) / 10)
)

// Hero donut (SVG stroke-dasharray)
const DONUT_R = 56
const donutCircumference = 2 * Math.PI * DONUT_R
const donutDash = computed(() =>
  (Math.min(100, pctResolvido.value) / 100) * donutCircumference
)

// Stacked bar widths
const pctOkBar = computed(() =>
  resumo.value.total_aptos > 0
    ? (semPendencias.value / resumo.value.total_aptos) * 100
    : 0
)
const pctPendBar = computed(() =>
  resumo.value.total_aptos > 0
    ? (resumo.value.total_com_pendencias / resumo.value.total_aptos) * 100
    : 0
)

// Mini KPIs
const criticos = computed(() => alunos.value.filter(a => a.total_pendencias >= 3).length)

const mediaPendencias = computed(() => {
  if (!resumo.value.total_com_pendencias) return '0,0'
  return (resumo.value.total_pendencias_ativas / resumo.value.total_com_pendencias)
    .toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
})

// ── Tipos section ──────────────────────────────────────────────────────────
const maxAfetados = computed(() => Math.max(tipos.value[0]?.total_afetados ?? 1, 1))
const visibleTipos = computed(() =>
  showAllTipos.value ? tipos.value : tipos.value.slice(0, 5)
)
const tiposAtivos = computed(() => tipos.value.filter(t => t.total_afetados > 0).length)

// ── Top 10 alunos críticos ─────────────────────────────────────────────────
const top10Alunos = computed(() => alunos.value.slice(0, 10))

// ── Table filter ──────────────────────────────────────────────────────────
const filteredAlunos = computed(() => {
  if (!searchAluno.value.trim()) return alunos.value
  const q = searchAluno.value.toLowerCase()
  return alunos.value.filter(a =>
    a.nom_aluno.toLowerCase().includes(q) || a.num_matricula.includes(q)
  )
})

const tabCounts = computed(() => ({
  todos: filteredAlunos.value.length,
  criticos: filteredAlunos.value.filter(a => a.total_pendencias >= 3).length,
  alerta: filteredAlunos.value.filter(a => a.total_pendencias === 2).length,
  umPend: filteredAlunos.value.filter(a => a.total_pendencias === 1).length
}))

const tableAlunos = computed(() => {
  switch (activeFilter.value) {
    case 1: return filteredAlunos.value.filter(a => a.total_pendencias >= 3)
    case 2: return filteredAlunos.value.filter(a => a.total_pendencias === 2)
    case 3: return filteredAlunos.value.filter(a => a.total_pendencias === 1)
    default: return filteredAlunos.value
  }
})

const indexedTableAlunos = computed(() =>
  tableAlunos.value.map((a, i) => ({ ...a, rank: i + 1 }))
)

const tableColumns = [
  { key: 'rank', label: '#' },
  { key: 'nom_aluno', label: 'Aluno', sortable: true },
  { key: 'num_matricula', label: 'Matrícula' },
  { key: 'total_pendencias', label: 'Pendências', sortable: true }
]

// ── Helpers ────────────────────────────────────────────────────────────────
const tabelaMap: Record<string, { color: 'info' | 'primary' | 'success' | 'neutral'; label: string }> = {
  ALUNO: { color: 'info', label: 'Aluno' },
  TURMA: { color: 'primary', label: 'Turma' },
  CURSO: { color: 'success', label: 'Curso' }
}

function getTabelaBadge(tabela: string) {
  return tabelaMap[tabela] ?? { color: 'neutral' as const, label: tabela }
}

function getPendenciasColor(total: number): 'neutral' | 'info' | 'warning' | 'error' {
  if (total === 0) return 'neutral'
  if (total >= 3) return 'error'
  if (total === 2) return 'warning'
  return 'info'
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
]

function avatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function getSevPips(total: number): { filled: number; empty: number } {
  const max = 5
  const filled = Math.min(total, max)
  return { filled, empty: max - filled }
}

function tipoBarWidth(afetados: number): string {
  return `${(afetados / maxAfetados.value) * 100}%`
}

function tipoPctAptos(afetados: number): string {
  if (!resumo.value.total_aptos) return '0,0'
  return ((afetados / resumo.value.total_aptos) * 100)
    .toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

function tipoPctPendentes(afetados: number): string {
  if (!resumo.value.total_com_pendencias) return '0'
  return ((afetados / resumo.value.total_com_pendencias) * 100)
    .toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

// ── Actions ────────────────────────────────────────────────────────────────
async function handleRefresh() {
  refreshing.value = true
  await Promise.all([refreshResumo(), refreshTipos(), refreshAlunos()])
  lastUpdated.value = new Date().toLocaleTimeString('pt-BR')
  refreshing.value = false
}

function scrollToTabela() {
  activeFilter.value = 0
  nextTick(() => tabelaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

watch(loading, (val) => {
  if (!val && !lastUpdated.value) {
    lastUpdated.value = new Date().toLocaleTimeString('pt-BR')
  }
})

watch(searchAluno, () => { activeFilter.value = 0 })
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">

    <!-- ── Page Header ── -->
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Visão Geral — Rematrícula
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Impacto de pendências por tipo e por aluno
          <span v-if="lastUpdated" class="ml-1">· Atualizado às {{ lastUpdated }}</span>
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
          Databricks · Atualização diária D-1
        </span>
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="refreshing"
          :disabled="loading"
          @click="handleRefresh"
        >
          Atualizar
        </UButton>
      </div>
    </div>

    <!-- ── Error banner ── -->
    <UAlert
      v-if="hasError && !loading"
      icon="i-lucide-wifi-off"
      color="error"
      variant="subtle"
      title="Erro ao carregar dados"
      :description="errorMessage || 'Verifique a conexão com o Databricks e tente novamente.'"
    />

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- ── HERO: Impact Card ── -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <UCard class="overflow-hidden">

      <!-- Loading skeleton -->
      <template v-if="loading && resumo.total_aptos === 0">
        <div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">
          <USkeleton class="w-36 h-36 rounded-full mx-auto" />
          <div class="space-y-4">
            <div class="space-y-1.5">
              <USkeleton class="h-5 w-56" />
              <USkeleton class="h-4 w-full" />
            </div>
            <USkeleton class="h-5 w-full rounded-lg" />
            <div class="grid grid-cols-3 gap-3">
              <USkeleton v-for="i in 3" :key="i" class="h-16 rounded-lg" />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center">

          <!-- Left: Large Donut ── -->
          <div class="flex flex-col items-center gap-2">
            <div class="relative" style="width:140px; height:140px;">
              <svg
                width="140" height="140" viewBox="0 0 140 140"
                class="transform -rotate-90"
              >
                <!-- Track -->
                <circle
                  cx="70" cy="70" :r="DONUT_R"
                  fill="none" stroke="currentColor" stroke-width="14"
                  class="text-gray-200 dark:text-gray-700"
                />
                <!-- Progress arc -->
                <circle
                  cx="70" cy="70" :r="DONUT_R"
                  fill="none" stroke="currentColor" stroke-width="14"
                  stroke-linecap="round"
                  :stroke-dasharray="`${donutDash} ${donutCircumference}`"
                  class="text-green-500 transition-all duration-700"
                />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                  {{ pctResolvido }}%
                </span>
                <span class="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight mt-1">
                  Aptos<br/>sem bloqueio
                </span>
              </div>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 text-center">
              Progresso geral da rematrícula
            </p>
          </div>

          <!-- Right: Title + bar + KPIs ── -->
          <div class="space-y-4">

            <div>
              <h2 class="text-base font-bold text-gray-900 dark:text-white">
                Impacto na Rematrícula dos Alunos
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                De
                <strong class="text-gray-800 dark:text-gray-200">
                  {{ resumo.total_aptos.toLocaleString('pt-BR') }}
                </strong>
                alunos aptos,
                <strong class="text-red-500">
                  {{ resumo.total_com_pendencias.toLocaleString('pt-BR') }}
                </strong>
                ({{ pctPendentes }}%) ainda possuem pendências ativas que bloqueiam o processo.
              </p>
            </div>

            <!-- Stacked bar -->
            <div class="space-y-1.5">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Distribuição dos alunos aptos
              </p>
              <div class="flex h-5 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <div
                  class="bg-green-500 transition-all duration-700"
                  :style="{ width: `${pctOkBar}%` }"
                />
                <div
                  class="bg-red-400 transition-all duration-700"
                  :style="{ width: `${pctPendBar}%` }"
                />
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-sm bg-green-500 shrink-0" />
                  {{ semPendencias.toLocaleString('pt-BR') }} sem pendência ({{ pctResolvido }}%)
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-sm bg-red-400 shrink-0" />
                  {{ resumo.total_com_pendencias.toLocaleString('pt-BR') }} com pendência ({{ pctPendentes }}%)
                </div>
              </div>
            </div>

            <!-- Mini KPIs -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Total de Pendências Ativas</p>
                <p class="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {{ resumo.total_pendencias_ativas.toLocaleString('pt-BR') }}
                </p>
              </div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Alunos c/ 3+ pendências</p>
                <p class="text-xl font-bold text-red-500 tabular-nums">
                  {{ criticos.toLocaleString('pt-BR') }}
                </p>
                <p class="text-[10px] text-amber-500 mt-0.5">⚠ Atenção prioritária</p>
              </div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Média de pendências</p>
                <p class="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {{ mediaPendencias }}
                </p>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">por aluno afetado</p>
              </div>
            </div>

          </div>
        </div>
      </template>
    </UCard>

    <!-- ── Section divider ── -->
    <div class="flex items-center gap-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
      <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      Detalhamento
      <div class="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- ── SPLIT: Tipos por barra | Top alunos críticos ── -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

      <!-- LEFT: Pendências por Tipo ── -->
      <UCard class="overflow-hidden">
        <!-- Panel header -->
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bar-chart-2" class="w-4 h-4 text-gray-400" />
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Pendências por Tipo</h3>
          </div>
          <UBadge v-if="!loadingTipos" color="neutral" variant="subtle" size="sm">
            {{ tiposAtivos }} tipo{{ tiposAtivos !== 1 ? 's' : '' }} ativo{{ tiposAtivos !== 1 ? 's' : '' }}
          </UBadge>
        </div>

        <!-- Loading -->
        <template v-if="loadingTipos">
          <div class="space-y-5">
            <div v-for="i in 5" :key="i" class="space-y-1.5">
              <div class="flex justify-between">
                <USkeleton class="h-3.5 w-2/3" />
                <USkeleton class="h-3.5 w-10" />
              </div>
              <USkeleton class="h-2 w-full rounded-full" />
              <USkeleton class="h-3 w-1/2" />
            </div>
          </div>
        </template>

        <!-- Empty -->
        <template v-else-if="tipos.length === 0">
          <div class="flex flex-col items-center justify-center py-10 text-center">
            <UIcon name="i-lucide-check-circle" class="w-10 h-10 text-green-400 mb-2" />
            <p class="font-semibold text-gray-700 dark:text-gray-300 text-sm">Nenhuma pendência ativa</p>
            <p class="text-xs text-gray-500 mt-1">Todos os tipos estão zerados.</p>
          </div>
        </template>

        <!-- Type rows -->
        <template v-else>
          <div class="space-y-4">

            <div v-for="tipo in visibleTipos" :key="tipo.id" class="space-y-1.5">
              <!-- Row: name + badges + count -->
              <div class="flex items-start justify-between gap-2">
                <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span class="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
                    {{ tipo.nom_pendencia }}
                  </span>
                  <UBadge :color="getTabelaBadge(tipo.tabela).color" variant="subtle" size="xs">
                    {{ getTabelaBadge(tipo.tabela).label }}
                  </UBadge>
                  <UBadge v-if="tipo.ind_prerematricula" color="warning" variant="subtle" size="xs">
                    Pré-matrícula
                  </UBadge>
                </div>
                <span
                  class="text-sm font-bold tabular-nums shrink-0 pt-0.5"
                  :class="tipo.total_afetados > 0 ? 'text-gray-900 dark:text-white' : 'text-green-500'"
                >
                  {{ tipo.total_afetados.toLocaleString('pt-BR') }}
                </span>
              </div>

              <!-- Proportional bar -->
              <div class="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  class="h-2 rounded-full transition-all duration-700"
                  :class="tipo.total_afetados > 0 ? 'bg-blue-500' : 'bg-green-400'"
                  :style="{ width: tipoBarWidth(tipo.total_afetados) }"
                />
              </div>

              <!-- Sub-stats -->
              <p class="text-xs text-gray-400 dark:text-gray-500">
                {{ tipoPctAptos(tipo.total_afetados) }}% dos alunos aptos
                <template v-if="tipo.total_afetados > 0 && resumo.total_com_pendencias > 0">
                  · <strong class="text-gray-500 dark:text-gray-400">{{ tipoPctPendentes(tipo.total_afetados) }}%</strong> dos com pendência
                </template>
              </p>
            </div>

            <!-- Expand/collapse -->
            <UButton
              v-if="tipos.length > 5"
              variant="ghost"
              color="neutral"
              size="sm"
              class="w-full justify-center"
              :icon="showAllTipos ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              @click="showAllTipos = !showAllTipos"
            >
              {{ showAllTipos ? 'Mostrar menos' : `Ver todos os ${tipos.length} tipos` }}
            </UButton>

          </div>
        </template>
      </UCard>

      <!-- RIGHT: Top Alunos Críticos ── -->
      <UCard class="overflow-hidden">
        <!-- Panel header -->
        <div class="flex items-center justify-between pb-3 mb-1 border-b border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" />
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Alunos mais Afetados</h3>
          </div>
          <UBadge color="neutral" variant="subtle" size="sm">Top 10</UBadge>
        </div>

        <!-- Loading -->
        <template v-if="loadingAlunos">
          <div class="space-y-1 pt-1">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 py-2">
              <USkeleton class="w-5 h-3 shrink-0" />
              <USkeleton class="w-8 h-8 rounded-full shrink-0" />
              <div class="flex-1 space-y-1.5">
                <USkeleton class="h-3.5 w-3/4" />
                <USkeleton class="h-2.5 w-1/2" />
              </div>
              <USkeleton class="w-14 h-3" />
            </div>
          </div>
        </template>

        <!-- Empty -->
        <template v-else-if="top10Alunos.length === 0">
          <div class="flex flex-col items-center justify-center py-10 text-center">
            <UIcon name="i-lucide-check-circle" class="w-10 h-10 text-green-400 mb-2" />
            <p class="font-semibold text-gray-700 dark:text-gray-300 text-sm">Nenhum aluno com pendências</p>
          </div>
        </template>

        <!-- Student rows -->
        <template v-else>
          <div class="-mx-4 sm:-mx-6">
            <div
              v-for="(aluno, idx) in top10Alunos"
              :key="aluno.cod_aluno"
              class="flex items-center gap-3 px-4 sm:px-6 py-2.5
                     border-b border-gray-50 dark:border-gray-800 last:border-0
                     hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <!-- Rank -->
              <span class="w-5 shrink-0 text-center text-xs font-bold text-gray-400 dark:text-gray-500">
                {{ idx + 1 }}
              </span>

              <!-- Avatar -->
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                :class="avatarColor(idx)"
              >
                {{ getInitials(aluno.nom_aluno) }}
              </div>

              <!-- Name + RA -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ aluno.nom_aluno }}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  RA: {{ aluno.num_matricula }}
                </p>
              </div>

              <!-- Severity pips + count -->
              <div class="flex items-center gap-1.5 shrink-0">
                <div class="flex gap-0.5">
                  <span
                    v-for="n in getSevPips(aluno.total_pendencias).filled"
                    :key="`f-${n}`"
                    class="w-2 h-2 rounded-full"
                    :class="{
                      'bg-red-500': aluno.total_pendencias >= 3,
                      'bg-amber-400': aluno.total_pendencias === 2,
                      'bg-blue-400': aluno.total_pendencias === 1
                    }"
                  />
                  <span
                    v-for="n in getSevPips(aluno.total_pendencias).empty"
                    :key="`e-${n}`"
                    class="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700"
                  />
                </div>
                <span class="text-sm font-bold text-gray-600 dark:text-gray-400 tabular-nums w-4 text-right">
                  {{ aluno.total_pendencias }}
                </span>
              </div>
            </div>
          </div>

          <UButton
            v-if="alunos.length > 10"
            variant="ghost"
            color="neutral"
            size="sm"
            class="w-full justify-center mt-3"
            icon="i-lucide-chevron-down"
            @click="scrollToTabela"
          >
            Ver todos os {{ alunos.length.toLocaleString('pt-BR') }} alunos
          </UButton>
        </template>
      </UCard>

    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- ── TABLE: Detalhamento por Aluno ── -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div ref="tabelaRef">
    <UCard class="overflow-hidden">

      <!-- Table header -->
      <div class="flex items-center justify-between gap-4 flex-wrap pb-3 mb-0 border-b border-gray-100 dark:border-gray-800">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Detalhamento — Por Aluno</h3>
        <UInput
          v-model="searchAluno"
          icon="i-lucide-search"
          placeholder="Buscar por nome ou matrícula..."
          size="sm"
          class="w-64"
        />
      </div>

      <!-- Filter tabs -->
      <div class="-mx-4 sm:-mx-6 px-4 sm:px-6 flex gap-0 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <button
          v-for="(tab, idx) in [
            `Todos com Pendências (${tabCounts.todos})`,
            `Críticos — 3+ pend. (${tabCounts.criticos})`,
            `Em Alerta — 2 pend. (${tabCounts.alerta})`,
            `Com 1 pendência (${tabCounts.umPend})`
          ]"
          :key="idx"
          class="px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap"
          :class="activeFilter === idx
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          @click="activeFilter = idx"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Loading -->
      <template v-if="loadingAlunos">
        <div class="pt-4">
          <USkeleton class="h-64 w-full rounded-xl" />
        </div>
      </template>

      <!-- Empty state -->
      <template v-else-if="tableAlunos.length === 0">
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <UIcon
            :name="searchAluno ? 'i-lucide-search-x' : 'i-lucide-check-circle'"
            class="w-10 h-10 mb-2"
            :class="searchAluno ? 'text-gray-300 dark:text-gray-600' : 'text-green-400'"
          />
          <p class="font-semibold text-gray-700 dark:text-gray-300 text-sm">
            {{ searchAluno ? 'Nenhum aluno encontrado' : 'Nenhum aluno neste filtro' }}
          </p>
          <p v-if="searchAluno" class="text-xs text-gray-500 mt-1">
            Tente um nome ou matrícula diferente.
          </p>
        </div>
      </template>

      <!-- Table -->
      <template v-else>
        <p class="text-xs text-gray-400 dark:text-gray-500 pt-3 pb-1">
          {{ tableAlunos.length.toLocaleString('pt-BR') }}
          {{ tableAlunos.length === 1 ? 'aluno' : 'alunos' }}
          <template v-if="searchAluno"> para "{{ searchAluno }}"</template>
        </p>

        <UTable :rows="indexedTableAlunos" :columns="tableColumns">

          <!-- # column -->
          <template #rank-data="{ row }">
            <span class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{{ row.rank }}</span>
          </template>

          <!-- Aluno column -->
          <template #nom_aluno-data="{ row }">
            <div class="flex items-center gap-2">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                :class="avatarColor(row.rank - 1)"
              >
                {{ getInitials(row.nom_aluno) }}
              </div>
              <span class="font-medium text-sm text-gray-900 dark:text-white">{{ row.nom_aluno }}</span>
            </div>
          </template>

          <!-- Matrícula column -->
          <template #num_matricula-data="{ row }">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ row.num_matricula }}</span>
          </template>

          <!-- Pendências column -->
          <template #total_pendencias-data="{ row }">
            <div class="flex items-center gap-2">
              <UBadge :color="getPendenciasColor(row.total_pendencias)" variant="subtle" size="sm">
                {{ row.total_pendencias }} {{ row.total_pendencias === 1 ? 'pendência' : 'pendências' }}
              </UBadge>
              <div class="flex gap-0.5">
                <span
                  v-for="n in getSevPips(row.total_pendencias).filled"
                  :key="`f-${n}`"
                  class="w-1.5 h-1.5 rounded-full"
                  :class="{
                    'bg-red-500': row.total_pendencias >= 3,
                    'bg-amber-400': row.total_pendencias === 2,
                    'bg-blue-400': row.total_pendencias === 1
                  }"
                />
                <span
                  v-for="n in getSevPips(row.total_pendencias).empty"
                  :key="`e-${n}`"
                  class="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700"
                />
              </div>
            </div>
          </template>

        </UTable>
      </template>

    </UCard>
    </div>

  </div>
</template>
