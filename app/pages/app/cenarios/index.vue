<script setup lang="ts">
import type { CenarioE2e, StatusCenarioE2e } from '~~/types'
import CoberturaTab from '~/components/app/e2e/CoberturaTab.vue'
import NaoEncontradosTab from '~/components/app/e2e/NaoEncontradosTab.vue'
import ExecucaoTab from '~/components/app/e2e/ExecucaoTab.vue'
import EsteiraPainel from '~/components/app/e2e/EsteiraPainel.vue'
import CenarioFormModal from '~/components/app/e2e/CenarioFormModal.vue'
import CapturaModal from '~/components/app/e2e/CapturaModal.vue'
import SenhaModal from '~/components/app/e2e/SenhaModal.vue'

/**
 * Tela "Cenários E2E" (e2e/PLANO.md): Cobertura + Não encontrados (etapa 4) + Execução (etapa 5).
 */
useSeoMeta({ titleTemplate: '', title: 'Rematrícula - Cenários E2E', description: 'Cenários e gravações dos testes de tela da rematrícula' })

const e2e = useCenariosE2e()
const toast = useToast()

const aba = ref('cobertura')
const precisamDeAtencao = computed(() =>
  e2e.cenarios.value.filter(c => precisaDeAluno(c) || c.status === 'a-confirmar').length
)
const abas = computed(() => [
  { label: 'Cobertura', value: 'cobertura', slot: 'cobertura' as const, icon: 'i-lucide-layout-grid' },
  { label: 'Não encontrados', value: 'nao-encontrados', slot: 'nao-encontrados' as const, icon: 'i-lucide-user-search', badge: precisamDeAtencao.value || undefined },
  { label: 'Execução', value: 'execucao', slot: 'execucao' as const, icon: 'i-lucide-play-circle' }
])

const contagem = computed(() => {
  const r = {} as Record<StatusCenarioE2e, number>
  for (const s of Object.keys(STATUS_E2E) as StatusCenarioE2e[]) r[s] = 0
  for (const c of e2e.cenarios.value) r[c.status]++
  return r
})
const pendentesDatabricks = computed(() =>
  e2e.cenarios.value.filter(c => c.fonte === 'databricks' && ['a-gravar', 'nao-encontrado', 'divergente'].includes(c.status)).length
)
const mostrarEsteira = computed(() => !!e2e.esteira.value && (e2e.esteira.value.rodando || !!e2e.esteira.value.iniciadoEm))

// Captura em tela cheia
const captura = ref<{ caminho: string, titulo: string } | null>(null)
function verCaptura(caminho: string, titulo: string) {
  captura.value = { caminho, titulo }
}

// Formulário de cenário
const form = reactive<{ aberto: boolean, modo: ModoFormCenario, cenario: CenarioE2e | null, origem: OrigemGravacao | null }>({
  aberto: false, modo: 'novo', cenario: null, origem: null
})
function abrirForm(modo: ModoFormCenario, cenario: CenarioE2e | null = null, origem: OrigemGravacao | null = null) {
  Object.assign(form, { aberto: true, modo, cenario, origem })
}
async function salvarForm(corpo: Record<string, unknown>) {
  if (form.modo === 'novo' || form.modo === 'a-partir-de') {
    const c = await e2e.criar(corpo)
    toast.add({ title: `Cenário criado: ${c.id}`, description: STATUS_E2E[c.status].ajuda, color: 'success' })
  } else if (form.cenario) {
    const c = await e2e.alterar(form.cenario.id, corpo)
    toast.add({ title: form.modo === 'confirmar' ? `Confirmado: ${c.id}` : `Salvo: ${c.id}`, color: 'success' })
  }
}

async function gerar(ids?: string[]) {
  await e2e.gerar(ids)
  if (e2e.rodando.value) toast.add({ title: 'Geração iniciada', description: 'O andamento aparece no painel da esteira.', color: 'info' })
}

async function gravar(id: string, codigoAluno: number, liberar: boolean) {
  const r = await e2e.gravar(id, codigoAluno, liberar)
  if (r.resultado) {
    const s = STATUS_E2E[r.resultado.status]
    toast.add({ title: `${id}: ${s.rotulo}`, description: s.ajuda, color: s.cor === 'neutral' ? 'info' : s.cor })
  }
  return r
}
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">
          Cenários E2E
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Cenários da jornada do aluno gravados em HML e reproduzidos sem backend pelos testes de tela.
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="e2e.carregando.value"
          aria-label="Atualizar"
          @click="e2e.carregar()"
        />
        <UButton
          icon="i-lucide-play"
          :disabled="e2e.rodando.value || !pendentesDatabricks"
          @click="gerar()"
        >
          Gerar pendentes ({{ pendentesDatabricks }})
        </UButton>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <UBadge
        v-for="(n, s) in contagem"
        :key="s"
        :color="STATUS_E2E[s].cor"
        variant="subtle"
        size="lg"
        :title="STATUS_E2E[s].ajuda"
      >
        {{ STATUS_E2E[s].rotulo }}: {{ n }}
      </UBadge>
    </div>

    <UAlert
      v-if="e2e.erro.value"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="e2e.erro.value"
      :close="{ color: 'error', variant: 'link' }"
      @update:open="e2e.erro.value = null"
    />

    <EsteiraPainel v-if="mostrarEsteira && e2e.esteira.value" :esteira="e2e.esteira.value" @captura="verCaptura" />

    <div v-if="!e2e.dados.value && e2e.carregando.value" class="py-12 text-center text-gray-500">
      Carregando catálogo…
    </div>

    <UTabs
      v-else-if="e2e.dados.value"
      v-model="aba"
      :items="abas"
      variant="link"
      :unmount-on-hide="false"
      class="w-full"
    >
      <template #cobertura>
        <CoberturaTab
          class="pt-4"
          :cenarios="e2e.cenarios.value"
          :arquivos="e2e.dados.value.arquivos"
          :rodando="e2e.rodando.value"
          @gerar="gerar"
          @editar="c => abrirForm('editar', c)"
          @captura="verCaptura"
        />
      </template>
      <template #nao-encontrados>
        <NaoEncontradosTab
          class="pt-4"
          :cenarios="e2e.cenarios.value"
          :arquivos="e2e.dados.value.arquivos"
          :esteira="e2e.esteira.value"
          :rodando="e2e.rodando.value"
          :gravar="gravar"
          @novo="abrirForm('novo')"
          @confirmar="c => abrirForm('confirmar', c)"
          @a-partir-de="o => abrirForm('a-partir-de', null, o)"
          @captura="verCaptura"
        />
      </template>
      <template #execucao>
        <ExecucaoTab
          class="pt-4"
          :cenarios="e2e.cenarios.value"
          :arquivos="e2e.dados.value.arquivos"
          :esteira-rodando="!!e2e.esteira.value?.rodando"
          @captura="verCaptura"
        />
      </template>
    </UTabs>

    <CenarioFormModal
      :aberto="form.aberto"
      :modo="form.modo"
      :cenario="form.cenario"
      :origem="form.origem"
      :salvar="salvarForm"
      @fechar="form.aberto = false"
    />
    <CapturaModal :caminho="captura?.caminho ?? null" :titulo="captura?.titulo" @fechar="captura = null" />
    <SenhaModal :aberto="e2e.senhaPedida.value" @responder="e2e.responderSenha" />
  </div>
</template>
