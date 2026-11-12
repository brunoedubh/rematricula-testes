<script setup lang="ts">
import type { ArquivosCenarioE2e, CenarioE2e, StatusCenarioE2e } from '~~/types'

/** Aba Cenários, visão "Todos": o catálogo inteiro, com status, perfil e gravação (e2e/PLANO.md 2). */
const props = defineProps<{
  cenarios: CenarioE2e[]
  arquivos: Record<string, ArquivosCenarioE2e>
  rodando: boolean
}>()
const emit = defineEmits<{
  gerar: [ids: string[]]
  editar: [cenario: CenarioE2e]
  filtro: [cenario: CenarioE2e]
  captura: [caminho: string, titulo: string]
  /** Abrir o cenário na visão "Precisam de ação" (informar aluno, conferir a tela) */
  resolver: [cenario: CenarioE2e]
}>()

const busca = ref('')
/** Controlado pela página: os badges de status do topo filtram esta lista */
const filtroStatus = defineModel<StatusCenarioE2e | 'todos'>('status', { default: 'todos' })
const precisaDeAcao = (c: CenarioE2e) => precisaDeAluno(c) || c.status === 'a-confirmar'

const opcoesStatus = computed(() => [
  { label: 'Todos os status', value: 'todos' },
  ...(Object.keys(STATUS_E2E) as StatusCenarioE2e[]).map(s => ({
    label: `${STATUS_E2E[s].rotulo} (${props.cenarios.filter(c => c.status === s).length})`,
    value: s
  }))
])

const visiveis = computed(() => {
  const q = busca.value.trim().toLowerCase()
  return props.cenarios.filter(c =>
    (filtroStatus.value === 'todos' || c.status === filtroStatus.value)
    && (!q || c.id.includes(q) || c.titulo.toLowerCase().includes(q))
  )
})

/** Gravação com mais de 60 dias: o HML e a API mudam; vale regravar. */
function antiga(c: CenarioE2e): boolean {
  if (!c.gravadoEm) return false
  return Date.now() - new Date(c.gravadoEm).getTime() > 60 * 24 * 3600 * 1000
}

const rg = useRegrasE2e()
const regrasDe = (c: CenarioE2e): string[] => [c.regra ?? []].flat()
/** O aluno gravado cai numa regra que não é a do cenário */
function massaNaoBate(c: CenarioE2e): boolean {
  const doAluno = props.arquivos[c.id]?.regra?.id
  return !!doAluno && regrasDe(c).length > 0 && !regrasDe(c).includes(doAluno)
}

const data = (iso?: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : ''
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <UInput
        v-model="busca"
        icon="i-lucide-search"
        placeholder="Buscar cenário"
        class="w-full sm:w-64"
      />
      <USelect v-model="filtroStatus" :items="opcoesStatus" class="w-full sm:w-56" />
    </div>

    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table class="w-full min-w-[720px] text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
          <tr>
            <th class="px-3 py-2">
              Cenário
            </th>
            <th class="px-3 py-2">
              Status
            </th>
            <th class="px-3 py-2">
              Perfil
            </th>
            <th class="px-3 py-2 text-right">
              Alunos
            </th>
            <th class="px-3 py-2">
              Gravação
            </th>
            <th class="px-3 py-2 text-right">
              Ações
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="c in visiveis" :key="c.id" class="align-top">
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ c.titulo }}
              </div>
              <div class="font-mono text-xs text-gray-500">
                {{ c.id }}
              </div>
              <div v-if="c.esperado?.rota" class="mt-0.5 font-mono text-xs text-gray-500">
                → {{ c.esperado.rota }}
              </div>
              <div v-if="regrasDe(c).length" class="mt-1 text-xs">
                <UIcon name="i-lucide-scale" class="mr-0.5 align-text-bottom text-gray-500" />
                <span class="text-gray-600 dark:text-gray-400">{{ regrasDe(c).map(rg.tituloRegra).join(' ou ') }}</span>
              </div>
              <div v-else class="mt-1 text-xs text-warning" title="Sem regra, o teste não sabe dizer se a tela está certa: só repete a gravação">
                <UIcon name="i-lucide-scale" class="mr-0.5 align-text-bottom" />
                sem regra definida
              </div>
            </td>
            <td class="px-3 py-2">
              <UBadge :color="STATUS_E2E[c.status].cor" variant="subtle" :title="STATUS_E2E[c.status].ajuda">
                {{ STATUS_E2E[c.status].rotulo }}
              </UBadge>
              <div class="mt-1 text-xs text-gray-500">
                {{ c.fonte === 'databricks' ? 'Databricks' : 'Manual' }}
              </div>
            </td>
            <td class="px-3 py-2">
              <code v-if="c.where" class="mb-1 block max-w-xs whitespace-pre-wrap break-words rounded bg-gray-50 px-1.5 py-1 text-xs dark:bg-gray-800/60">{{ c.where }}</code>
              <div class="flex max-w-xs flex-wrap gap-1">
                <UBadge
                  v-for="(frase, i) in descreverPerfil(c.perfil)"
                  :key="i"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  class="font-normal"
                >
                  {{ frase }}
                </UBadge>
              </div>
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              {{ c.alunosNoPerfil?.toLocaleString('pt-BR') ?? '—' }}
            </td>
            <td class="px-3 py-2 text-xs">
              <template v-if="arquivos[c.id]?.gravacao">
                <div :class="antiga(c) ? 'text-warning' : ''">
                  {{ data(c.gravadoEm) || 'sem data' }}
                  <UIcon v-if="antiga(c)" name="i-lucide-clock-alert" class="ml-1 align-middle" title="Gravação com mais de 60 dias" />
                </div>
                <div v-if="c.geradoPor" class="text-gray-500">
                  {{ c.geradoPor }}
                </div>
                <UBadge
                  v-if="c.avancos?.length"
                  color="info"
                  variant="outline"
                  size="xs"
                  class="mt-1"
                  :title="textoAvancos(c.avancos)"
                >
                  avançou: {{ c.avancos.join(', ') }}
                </UBadge>
                <div
                  v-if="arquivos[c.id]?.regra"
                  class="mt-1"
                  :class="massaNaoBate(c) ? 'text-warning' : 'text-gray-500'"
                  :title="massaNaoBate(c) ? 'O dado do aluno gravado cai em outra regra: o teste vai dar massa inválida. Descarte o aluno ou revise a regra.' : 'Regra que o dado do aluno gravado aciona'"
                >
                  <UIcon :name="massaNaoBate(c) ? 'i-lucide-user-x' : 'i-lucide-user-check'" class="mr-0.5 align-text-bottom" />
                  aluno: {{ arquivos[c.id]!.regra!.titulo }}
                </div>
              </template>
              <span v-else class="text-gray-400">sem gravação local</span>
            </td>
            <td class="px-3 py-2">
              <div class="flex justify-end gap-1">
                <UButton
                  v-if="precisaDeAcao(c)"
                  size="xs"
                  color="warning"
                  variant="soft"
                  icon="i-lucide-user-search"
                  :title="c.status === 'a-confirmar' ? 'Conferir a tela gravada' : 'Informar um aluno para este cenário'"
                  @click="emit('resolver', c)"
                >
                  Resolver
                </UButton>
                <UButton
                  v-if="arquivos[c.id]?.captura"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-image"
                  aria-label="Ver captura"
                  @click="emit('captura', arquivos[c.id]!.captura!, c.titulo)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  aria-label="Editar"
                  @click="emit('editar', c)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-database"
                  :title="c.fonte === 'databricks' ? 'Ver e editar o filtro SQL' : 'Cenário manual: escrever um WHERE para buscar no Databricks'"
                  aria-label="Filtro SQL"
                  @click="emit('filtro', c)"
                />
                <UButton
                  v-if="c.fonte === 'databricks'"
                  size="xs"
                  variant="soft"
                  icon="i-lucide-play"
                  :disabled="rodando"
                  @click="emit('gerar', [c.id])"
                >
                  {{ c.status === 'gravado' ? 'Regravar' : 'Gerar' }}
                </UButton>
              </div>
            </td>
          </tr>
          <tr v-if="!visiveis.length">
            <td colspan="6" class="px-3 py-6 text-center text-gray-500">
              Nenhum cenário com esse filtro.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
