<script setup lang="ts">
import type { CenarioE2e, StatusCenarioE2e } from '~~/types'
import CenariosLista from '~/components/app/e2e/CenariosLista.vue'
import CenariosPendentes from '~/components/app/e2e/CenariosPendentes.vue'
import ExecucaoTab from '~/components/app/e2e/ExecucaoTab.vue'
import MassaTab from '~/components/app/e2e/MassaTab.vue'
import RegrasTab from '~/components/app/e2e/RegrasTab.vue'
import EsteiraPainel from '~/components/app/e2e/EsteiraPainel.vue'
import CenarioFormModal from '~/components/app/e2e/CenarioFormModal.vue'
import CapturaModal from '~/components/app/e2e/CapturaModal.vue'
import SenhaModal from '~/components/app/e2e/SenhaModal.vue'
import DescartarModal from '~/components/app/e2e/DescartarModal.vue'
import type { PedidoDescarte } from '~/components/app/e2e/DescartarModal.vue'
import FiltroModal from '~/components/app/e2e/FiltroModal.vue'

/**
 * Tela "Cenários E2E" (e2e/PLANO.md):
 * - Cenários: o catálogo (Todos) e a fila do que precisa de alguém (Precisam de ação: informar aluno, conferir tela);
 * - Cobertura: cobertura por regra de tela + combinações (oráculo e2e/regras/regras.mjs);
 * - Massa de teste e Execução.
 */
useSeoMeta({ titleTemplate: '', title: 'Rematrícula - Cenários E2E', description: 'Cenários e gravações dos testes de tela da rematrícula' })

const e2e = useCenariosE2e()
const toast = useToast()

const aba = ref('cenarios')
const precisamDeAtencao = computed(() =>
  e2e.cenarios.value.filter(c => precisaDeAluno(c) || c.status === 'a-confirmar').length
)
const abas = computed(() => [
  { label: 'Cenários', value: 'cenarios', slot: 'cenarios' as const, icon: 'i-lucide-list-checks', badge: precisamDeAtencao.value || undefined },
  { label: 'Cobertura', value: 'cobertura', slot: 'cobertura' as const, icon: 'i-lucide-scale' },
  { label: 'Massa de teste', value: 'massa', slot: 'massa' as const, icon: 'i-lucide-users' },
  { label: 'Execução', value: 'execucao', slot: 'execucao' as const, icon: 'i-lucide-play-circle' }
])

// Aba Cenários: visão (todos / precisam de ação) e filtro de status (os badges do topo filtram)
const visao = ref<'todos' | 'acao'>('todos')
const filtroStatus = ref<StatusCenarioE2e | 'todos'>('todos')
const visoes = computed(() => [
  { label: `Todos (${e2e.cenarios.value.length})`, value: 'todos' as const, icon: 'i-lucide-list' },
  { label: `Precisam de ação (${precisamDeAtencao.value})`, value: 'acao' as const, icon: 'i-lucide-user-search' }
])
function filtrarStatus(s: StatusCenarioE2e) {
  aba.value = 'cenarios'
  visao.value = 'todos'
  filtroStatus.value = filtroStatus.value === s ? 'todos' : s
}

// "Resolver" na lista: abre a visão de ação no cartão do cenário
const destaque = ref<string | null>(null)
async function resolver(c: CenarioE2e) {
  visao.value = 'acao'
  destaque.value = c.id
  await nextTick()
  document.getElementById(`pendente-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  setTimeout(() => {
    if (destaque.value === c.id) destaque.value = null
  }, 2500)
}

const contagem = computed(() => {
  const r = {} as Record<StatusCenarioE2e, number>
  for (const s of Object.keys(STATUS_E2E) as StatusCenarioE2e[]) r[s] = 0
  for (const c of e2e.cenarios.value) r[c.status]++
  return r
})
const pendentesDatabricks = computed(() =>
  e2e.cenarios.value.filter(c => c.fonte === 'databricks' && ['a-gravar', 'nao-encontrado', 'divergente'].includes(c.status)).length
)
// A massa de teste muda quando a esteira termina ou um aluno é gravado.
const massa = ref<InstanceType<typeof MassaTab> | null>(null)
watch(() => e2e.rodando.value, (agora, antes) => {
  if (antes && !agora) massa.value?.carregar()
})

const mostrarEsteira = computed(() => !!e2e.esteira.value && (e2e.esteira.value.rodando || !!e2e.esteira.value.iniciadoEm))

// Captura em tela cheia
const captura = ref<{ caminho: string, titulo: string } | null>(null)
function verCaptura(caminho: string, titulo: string) {
  captura.value = { caminho, titulo }
}

// Captura de um aluno de um cenário → dá para descartá-lo dali mesmo
const CAPTURA_CANDIDATO = /^gravacoes\/candidatos\/([a-z0-9-]+)--(\d+)\.png$/
const CAPTURA_APROVADA = /^gravacoes\/([a-z0-9-]+)\.png$/
const alunoDaCaptura = computed<{ cenario: string, codigoAluno: number } | null>(() => {
  const caminho = captura.value?.caminho ?? ''
  const cand = caminho.match(CAPTURA_CANDIDATO)
  if (cand) return { cenario: cand[1]!, codigoAluno: Number(cand[2]) }
  const aprov = caminho.match(CAPTURA_APROVADA)
  const codigo = aprov ? e2e.dados.value?.arquivos[aprov[1]!]?.codigoAluno : undefined
  return aprov && codigo ? { cenario: aprov[1]!, codigoAluno: codigo } : null
})

// Descartar aluno (captura mostra que não condiz com o cenário)
const descarte = ref<PedidoDescarte | null>(null)
function pedirDescarte(cenarioId: string, codigoAluno: number) {
  const c = e2e.cenarios.value.find(x => x.id === cenarioId)
  const arq = e2e.dados.value?.arquivos[cenarioId]
  const aprovado = arq?.codigoAluno === codigoAluno && !!arq?.gravacao
  const captura = aprovado ? arq?.captura : arq?.candidatos.find(x => x.codigoAluno === codigoAluno)?.captura
  descarte.value = { cenario: cenarioId, titulo: c?.titulo, codigoAluno, aprovado, captura, podeGerar: c?.fonte === 'databricks' }
}
async function confirmarDescarte(motivo: string | undefined, gerarDeNovo: boolean) {
  const p = descarte.value
  if (!p) return
  await e2e.descartar(p.cenario, p.codigoAluno, motivo)
  captura.value = null
  massa.value?.carregar()
  toast.add({ title: `Aluno ${p.codigoAluno} descartado de ${p.cenario}`, description: 'A esteira não sorteia mais este código para o cenário.', color: 'success' })
  if (gerarDeNovo) await gerar([p.cenario])
}
async function permitir(cenarioId: string, codigoAluno: number) {
  await e2e.permitir(cenarioId, codigoAluno)
  massa.value?.carregar()
  toast.add({ title: `Aluno ${codigoAluno} pode ser sorteado de novo em ${cenarioId}`, color: 'info' })
}

// Filtro SQL do cenário
const filtroDe = ref<CenarioE2e | null>(null)
async function salvarFiltro(where: string, gerarDepois: boolean) {
  const c = filtroDe.value
  if (!c) return
  const atual = e2e.dados.value?.filtros[c.id]?.where ?? ''
  // '' com WHERE gravado = remover; texto diferente do atual = salvar (o cenário manual vira databricks)
  if (where.trim() !== atual.trim() || (!where.trim() && c.where)) {
    const novo = await e2e.alterar(c.id, { where })
    toast.add({
      title: where.trim() ? `Filtro de ${c.id} salvo` : `WHERE removido de ${c.id}`,
      description: c.fonte === 'manual' && novo.fonte === 'databricks' ? 'O cenário agora é buscado no Databricks.' : undefined,
      color: 'success'
    })
  }
  if (gerarDepois) await gerar([c.id])
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
      <UButton
        v-for="(n, s) in contagem"
        :key="s"
        :color="STATUS_E2E[s].cor"
        :variant="filtroStatus === s && aba === 'cenarios' && visao === 'todos' ? 'solid' : 'subtle'"
        size="sm"
        :title="`${STATUS_E2E[s].ajuda} (clique para filtrar a lista de cenários)`"
        @click="filtrarStatus(s)"
      >
        {{ STATUS_E2E[s].rotulo }}: {{ n }}
      </UButton>
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
      <template #cenarios>
        <div class="space-y-4 pt-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <UTabs
              v-model="visao"
              :items="visoes"
              :content="false"
              size="sm"
              class="w-full sm:w-auto"
            />
            <UButton icon="i-lucide-plus" variant="outline" @click="abrirForm('novo')">
              Novo cenário
            </UButton>
          </div>
          <CenariosLista
            v-show="visao === 'todos'"
            v-model:status="filtroStatus"
            :cenarios="e2e.cenarios.value"
            :arquivos="e2e.dados.value.arquivos"
            :rodando="e2e.rodando.value"
            @gerar="gerar"
            @editar="c => abrirForm('editar', c)"
            @filtro="c => filtroDe = c"
            @captura="verCaptura"
            @resolver="resolver"
          />
          <!-- v-show: mantém o código digitado e o resultado da gravação ao trocar de visão -->
          <CenariosPendentes
            v-show="visao === 'acao'"
            :cenarios="e2e.cenarios.value"
            :arquivos="e2e.dados.value.arquivos"
            :esteira="e2e.esteira.value"
            :rodando="e2e.rodando.value"
            :destaque="destaque"
            :gravar="gravar"
            @confirmar="c => abrirForm('confirmar', c)"
            @a-partir-de="o => abrirForm('a-partir-de', null, o)"
            @captura="verCaptura"
            @descartar="pedirDescarte"
            @filtro="c => filtroDe = c"
          />
        </div>
      </template>
      <template #massa>
        <MassaTab
          ref="massa"
          class="pt-4"
          :rodando="e2e.rodando.value"
          @captura="verCaptura"
          @descartar="pedirDescarte"
          @permitir="permitir"
        />
      </template>
      <template #cobertura>
        <RegrasTab
          class="pt-4"
          :cenarios="e2e.cenarios.value"
          :arquivos="e2e.dados.value.arquivos"
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
      :regra-gravada="form.modo === 'a-partir-de' ? form.origem?.regra : (form.cenario ? e2e.dados.value?.arquivos[form.cenario.id]?.regra : undefined)"
      :salvar="salvarForm"
      @fechar="form.aberto = false"
    />
    <CapturaModal
      :caminho="captura?.caminho ?? null"
      :titulo="captura?.titulo"
      :descartavel="!!alunoDaCaptura && !e2e.rodando.value"
      @fechar="captura = null"
      @descartar="alunoDaCaptura && pedirDescarte(alunoDaCaptura.cenario, alunoDaCaptura.codigoAluno)"
    />
    <DescartarModal :pedido="descarte" :descartar="confirmarDescarte" @fechar="descarte = null" />
    <FiltroModal
      :cenario="filtroDe"
      :filtro="filtroDe ? (e2e.dados.value?.filtros[filtroDe.id] ?? null) : null"
      :descartados="filtroDe ? (e2e.dados.value?.descartados[filtroDe.id] ?? []) : []"
      :rodando="e2e.rodando.value"
      :salvar="salvarFiltro"
      @fechar="filtroDe = null"
    />
    <SenhaModal :aberto="e2e.senhaPedida.value" @responder="e2e.responderSenha" />
  </div>
</template>
