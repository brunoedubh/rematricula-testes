<script setup lang="ts">
import type { ArquivosCenarioE2e, CenarioE2e, TesteExecucaoE2e } from '~~/types'

/**
 * Aba Execução (e2e/PLANO.md 5): escolhe alvo, dispositivos e cenários, roda a suíte e mostra
 * o resultado por cenário × dispositivo, com tela esperada × obtida, captura, GIF e trace.
 * Não precisa de credencial: a suíte só usa as gravações.
 */
const props = defineProps<{
  cenarios: CenarioE2e[]
  arquivos: Record<string, ArquivosCenarioE2e>
  /** A esteira de gravação está rodando (as duas não rodam juntas) */
  esteiraRodando: boolean
}>()
const emit = defineEmits<{ captura: [caminho: string, titulo: string] }>()

const ex = useExecucoesE2e()

// --- Formulário ------------------------------------------------------------

type Escopo = 'todos' | 'falhados' | 'escolher'

const alvo = ref<'hml' | 'local' | 'dev'>('hml')
const dispositivos = ref<string[]>(['desktop', 'mobile'])
const escopo = ref<Escopo>('todos')
const escolhidos = ref<string[]>([])

const rg = useRegrasE2e()
onMounted(() => {
  if (!rg.dados.value) void rg.carregar()
})
// A aba Cobertura (regras) mostra o resultado da última execução: atualiza quando a suíte termina.
watch(() => ex.rodando.value, (agora, antes) => {
  if (antes && !agora) void rg.carregar()
})

/** Cenários que viram teste: gravados e com a gravação nesta máquina */
const cenariosExecutaveis = computed(() => props.cenarios.filter(c => c.status === 'gravado' && props.arquivos[c.id]?.gravacao))
/** Combinações de regras com a gravação base nesta máquina */
const combinacoesExecutaveis = computed(() => {
  const ids = new Set(rg.dados.value?.combinacoesExecutaveis ?? [])
  return (rg.dados.value?.combinacoes ?? []).filter(c => ids.has(c.id))
})
const executaveis = computed(() => [
  ...cenariosExecutaveis.value.map(c => ({ id: c.id, titulo: c.titulo, combinacao: false })),
  ...combinacoesExecutaveis.value.map(c => ({ id: c.id, titulo: c.titulo, combinacao: true }))
])

const opcoesAlvo = computed(() => (ex.dados.value?.alvos ?? []).map(a => ({ label: a.rotulo, value: a.nome, description: a.url })))
const urlAlvo = computed(() => ex.dados.value?.alvos.find(a => a.nome === alvo.value)?.url)
const opcoesDispositivo = computed(() => (ex.dados.value?.dispositivos ?? ['desktop', 'mobile']).map(d => ({ label: d === 'desktop' ? 'Desktop' : 'Mobile', value: d })))

/** Cenários que falharam (ou ficaram instáveis / com massa inválida) na execução selecionada */
const falhados = computed(() => [...new Set((ex.execucao.value?.testes ?? [])
  .filter(t => t.situacao === 'falhou' || t.situacao === 'instavel' || t.situacao === 'massa-invalida')
  .map(t => t.cenario))])

const opcoesEscopo = computed(() => [
  { label: `Todos: ${cenariosExecutaveis.value.length} cenário(s) gravado(s) + ${combinacoesExecutaveis.value.length} combinação(ões) de regras`, value: 'todos' },
  { label: `Só os que falharam na execução selecionada (${falhados.value.length})`, value: 'falhados', disabled: !falhados.value.length },
  { label: 'Escolher cenários', value: 'escolher' }
])
const opcoesCenario = computed(() => executaveis.value.map(c => ({
  label: c.combinacao ? `Combinação: ${c.titulo}` : c.titulo,
  value: c.id,
  description: c.id
})))

const cenariosDoPedido = computed<string[] | undefined>(() => {
  if (escopo.value === 'falhados') return falhados.value
  if (escopo.value === 'escolher') return escolhidos.value
  return undefined
})

const podeRodar = computed(() =>
  !ex.rodando.value && !props.esteiraRodando && dispositivos.value.length > 0 && executaveis.value.length > 0
  && (escopo.value === 'todos' || !!cenariosDoPedido.value?.length)
)

async function rodar() {
  const ok = await ex.executar({ alvo: alvo.value, dispositivos: dispositivos.value, cenarios: cenariosDoPedido.value })
  if (ok && escopo.value === 'falhados') escopo.value = 'todos'
}

// --- Resultado -------------------------------------------------------------

const exec = computed(() => ex.execucao.value)
const progresso = computed(() => {
  const e = exec.value
  if (!e?.total) return 0
  return Math.round((e.testes.length / e.total) * 100)
})

const ORDEM = { 'falhou': 0, 'massa-invalida': 1, 'instavel': 2, 'pulado': 3, 'passou': 4 } as const
const testes = computed(() => [...(exec.value?.testes ?? [])].sort((a, b) =>
  ORDEM[a.situacao] - ORDEM[b.situacao] || a.cenario.localeCompare(b.cenario) || a.dispositivo.localeCompare(b.dispositivo)
))

const opcoesHistorico = computed(() => ex.execucoes.value.map(e => ({
  label: `${dataHora(e.inicio)} · ${alvoDaExecucao(e.id).toUpperCase()} · ${e.totais.passou}/${e.total} ok${e.totais.falhou ? ` · ${e.totais.falhou} falha(s)` : ''}`,
  value: e.id
})))
const historico = computed({
  get: () => ex.selecionada.value ?? undefined,
  set: (id?: string) => {
    if (id) void ex.selecionar(id)
  }
})

const aberto = ref<Set<string>>(new Set())
const chave = (t: TesteExecucaoE2e) => `${t.cenario}|${t.dispositivo}`
function alternar(t: TesteExecucaoE2e) {
  const s = new Set(aberto.value)
  if (s.has(chave(t))) s.delete(chave(t))
  else s.add(chave(t))
  aberto.value = s
}
const temDetalhe = (t: TesteExecucaoE2e) => !!t.erro || t.semGravacao.length > 0 || !!t.motivo || !!t.verificacoes?.length || !!t.regra

/** "7 de 7 verificações" (ressalvas à parte): mostra quanto o teste conferiu, não só se passou */
function placar(t: TesteExecucaoE2e): { ok: number, total: number, ressalvas: number } | null {
  const v = t.verificacoes ?? []
  if (!v.length) return null
  const reais = v.filter(x => !x.ressalva)
  return { ok: reais.filter(x => x.ok).length, total: reais.length, ressalvas: v.length - reais.length }
}

/** Campos do ObterInformacoesAluno que a regra leu, para mostrar como "campo = valor" */
function camposDaRegra(t: TesteExecucaoE2e): [string, string][] {
  return Object.entries(t.regra?.campos ?? {}).map(([k, v]) => [k, valorCampo(v)])
}

function iconeVerificacao(v: { ok: boolean, ressalva?: boolean }) {
  if (v.ok) return { nome: 'i-lucide-circle-check', cor: 'text-success' }
  if (v.ressalva) return { nome: 'i-lucide-triangle-alert', cor: 'text-warning' }
  return { nome: 'i-lucide-circle-x', cor: 'text-error' }
}

/** A rota obtida casa com a esperada (mesma regra do teste: regex sem diferenciar maiúsculas) */
function rotaConfere(t: TesteExecucaoE2e): boolean | undefined {
  if (!t.rotaEsperada || t.rotaObtida === undefined) return undefined
  try {
    return new RegExp(t.rotaEsperada, 'i').test(t.rotaObtida)
  } catch {
    return undefined
  }
}

function dataHora(iso?: string) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : ''
}
function duracao(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}
const duracaoTotal = computed(() => {
  const e = exec.value
  if (!e?.fim) return ''
  return duracao(new Date(e.fim).getTime() - new Date(e.inicio).getTime())
})
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="ex.erro.value"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="ex.erro.value"
      :close="{ color: 'error', variant: 'link' }"
      @update:open="ex.erro.value = null"
    />

    <!-- Nova execução -->
    <UCard :ui="{ body: 'space-y-4' }">
      <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <UFormField label="Alvo" :description="urlAlvo" :ui="{ description: 'font-mono text-xs break-all' }">
          <USelect v-model="alvo" :items="opcoesAlvo" class="w-full sm:w-72" :disabled="ex.rodando.value" />
        </UFormField>
        <UFormField label="Dispositivos">
          <UCheckboxGroup
            v-model="dispositivos"
            :items="opcoesDispositivo"
            orientation="horizontal"
            :disabled="ex.rodando.value"
          />
        </UFormField>
      </div>

      <UFormField label="Cenários">
        <URadioGroup v-model="escopo" :items="opcoesEscopo" :disabled="ex.rodando.value" />
      </UFormField>
      <USelectMenu
        v-if="escopo === 'escolher'"
        v-model="escolhidos"
        :items="opcoesCenario"
        value-key="value"
        multiple
        placeholder="Escolha um ou mais cenários"
        class="w-full"
        :disabled="ex.rodando.value"
      />

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          v-if="!ex.rodando.value"
          icon="i-lucide-play"
          :disabled="!podeRodar"
          @click="rodar"
        >
          Rodar
        </UButton>
        <UButton
          v-else
          color="error"
          variant="soft"
          icon="i-lucide-square"
          @click="ex.cancelar()"
        >
          Cancelar
        </UButton>
        <span v-if="esteiraRodando" class="text-sm text-warning">A esteira de gravação está rodando; espere terminar.</span>
        <span v-else-if="!executaveis.length" class="text-sm text-gray-500">
          Nenhum cenário gravado com gravação nesta máquina.
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">
          Não usa credencial: a API é servida das gravações em <code>e2e/gravacoes</code>.
        </span>
      </div>
    </UCard>

    <!-- Execução selecionada -->
    <div v-if="ex.execucoes.value.length || ex.rodando.value" class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-model="historico"
          :items="opcoesHistorico"
          placeholder="Execução"
          class="w-full sm:w-[28rem]"
          :disabled="ex.rodando.value"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="ex.carregando.value"
          aria-label="Atualizar execuções"
          @click="ex.carregar()"
        />
      </div>

      <UCard v-if="exec" :ui="{ body: 'space-y-3' }">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge :color="SITUACAO_EXECUCAO_E2E[exec.situacao].cor" variant="subtle">
              {{ SITUACAO_EXECUCAO_E2E[exec.situacao].rotulo }}
            </UBadge>
            <UBadge
              v-for="(n, s) in exec.totais"
              v-show="n > 0"
              :key="s"
              :color="SITUACAO_TESTE_E2E[s].cor"
              variant="outline"
            >
              {{ SITUACAO_TESTE_E2E[s].rotulo }}: {{ n }}
            </UBadge>
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ exec.iniciadoPor ?? exec.origem }} · {{ dataHora(exec.inicio) }}<template v-if="duracaoTotal"> · {{ duracaoTotal }}</template>
          </span>
        </div>
        <p class="font-mono text-xs break-all text-gray-500 dark:text-gray-400">
          {{ exec.alvo }} · {{ exec.dispositivos.join(', ') }}<template v-if="exec.cenarios"> · {{ exec.cenarios.join(', ') }}</template>
        </p>

        <div v-if="exec.situacao === 'rodando'" class="space-y-1">
          <UProgress :model-value="progresso" />
          <p class="text-xs text-gray-500">
            {{ exec.testes.length }} de {{ exec.total }} testes
          </p>
        </div>

        <UAlert
          v-for="(e, i) in exec.erros"
          :key="i"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          title="Erro da suíte"
        >
          <template #description>
            <pre class="whitespace-pre-wrap text-xs">{{ e }}</pre>
          </template>
        </UAlert>

        <div v-if="testes.length" class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table class="w-full min-w-[760px] text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th class="px-3 py-2">
                  Cenário
                </th>
                <th class="px-3 py-2">
                  Dispositivo
                </th>
                <th class="px-3 py-2">
                  Resultado
                </th>
                <th class="px-3 py-2">
                  Tela esperada × obtida
                </th>
                <th class="px-3 py-2 text-right">
                  Tempo
                </th>
                <th class="px-3 py-2 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <template v-for="t in testes" :key="chave(t)">
                <tr>
                  <td class="px-3 py-2">
                    <div class="font-medium">
                      {{ t.titulo }}
                    </div>
                    <div class="font-mono text-xs text-gray-500">
                      {{ t.cenario }}
                    </div>
                    <UBadge
                      v-if="t.tipo === 'combinacao'"
                      color="info"
                      variant="outline"
                      size="sm"
                      class="mt-1"
                      :title="`Dado montado sobre a gravação de ${t.base}: testa a prioridade das regras, não um aluno real`"
                    >
                      combinação
                    </UBadge>
                    <UBadge
                      v-else-if="t.tipo === 'fluxo'"
                      color="neutral"
                      variant="outline"
                      size="sm"
                      class="mt-1"
                      title="Fluxo com ação (tests/fluxos): confere o que o front faz depois do clique"
                    >
                      fluxo
                    </UBadge>
                  </td>
                  <td class="px-3 py-2">
                    <UIcon :name="t.dispositivo === 'mobile' ? 'i-lucide-smartphone' : 'i-lucide-monitor'" class="mr-1 size-4 align-text-bottom text-gray-500" />
                    {{ t.dispositivo }}
                  </td>
                  <td class="px-3 py-2">
                    <UBadge
                      :color="SITUACAO_TESTE_E2E[t.situacao].cor"
                      :icon="SITUACAO_TESTE_E2E[t.situacao].icone"
                      :title="AJUDA_SITUACAO_TESTE[t.situacao]"
                      variant="subtle"
                    >
                      {{ SITUACAO_TESTE_E2E[t.situacao].rotulo }}
                    </UBadge>
                    <div v-if="placar(t)" class="mt-1 text-xs text-gray-500" :title="'Conferências feitas pelo teste (abra o detalhe para ver cada uma)'">
                      {{ placar(t)!.ok }}/{{ placar(t)!.total }} verificações
                    </div>
                    <div v-else-if="t.situacao === 'passou' && t.tipo !== 'fluxo'" class="mt-1 text-xs text-warning" title="Execução antiga: só conferia a tela gravada, sem a regra">
                      sem verificação de regra
                    </div>
                    <UBadge
                      v-if="t.semGravacao.length"
                      color="warning"
                      variant="outline"
                      size="sm"
                      class="ml-1"
                      title="Chamadas de API que a gravação não tem"
                    >
                      {{ t.semGravacao.length }} sem gravação
                    </UBadge>
                  </td>
                  <td class="px-3 py-2 font-mono text-xs">
                    <div v-if="t.rotaRegra" class="text-gray-500" :title="t.regra ? `Regra: ${t.regra.regra.titulo}` : undefined">
                      <span class="font-sans">regra</span> {{ t.rotaRegra }}
                    </div>
                    <div v-else class="text-gray-500">
                      {{ t.rotaEsperada ?? '—' }}
                    </div>
                    <div :class="(t.rotaRegra ? !mesmaRotaE2e(t.rotaRegra, t.rotaObtida) : rotaConfere(t) === false) ? 'text-error' : ''">
                      <span v-if="t.rotaRegra" class="font-sans text-gray-500">obtida</span> {{ t.rotaObtida ?? '—' }}
                    </div>
                  </td>
                  <td class="px-3 py-2 text-right text-xs text-gray-500">
                    {{ duracao(t.duracaoMs) }}
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex justify-end gap-1">
                      <UButton
                        v-if="temDetalhe(t)"
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        :icon="aberto.has(chave(t)) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        :aria-label="aberto.has(chave(t)) ? 'Esconder detalhes' : 'Ver detalhes'"
                        @click="alternar(t)"
                      />
                      <UButton
                        v-if="t.captura"
                        size="xs"
                        variant="ghost"
                        icon="i-lucide-image"
                        aria-label="Captura"
                        @click="emit('captura', t.captura, `${t.titulo} · ${t.dispositivo}`)"
                      />
                      <UButton
                        v-if="t.gif"
                        size="xs"
                        variant="ghost"
                        icon="i-lucide-film"
                        aria-label="GIF do teste"
                        title="GIF do teste realizado"
                        @click="emit('captura', t.gif, `${t.titulo} · ${t.dispositivo} · GIF`)"
                      />
                      <UButton
                        v-if="t.trace"
                        size="xs"
                        variant="ghost"
                        icon="i-lucide-file-archive"
                        aria-label="Baixar trace"
                        title="Baixar trace (abrir com npx playwright show-trace ou em trace.playwright.dev)"
                        :href="urlArtefato(t.trace)"
                        download
                        external
                      />
                    </div>
                  </td>
                </tr>
                <tr v-if="aberto.has(chave(t))">
                  <td colspan="6" class="space-y-3 bg-gray-50/60 px-3 py-3 dark:bg-gray-800/30">
                    <p v-if="t.motivo" class="text-xs text-gray-600 dark:text-gray-400">
                      {{ t.motivo }}
                    </p>

                    <!-- Por que: a regra que valia para o dado usado no teste -->
                    <div v-if="t.regra" class="space-y-1 text-xs">
                      <p class="font-medium">
                        Regra que vale para o dado do aluno
                      </p>
                      <p>
                        <span class="font-semibold">{{ t.regra.regra.titulo }}</span>
                        → <code>{{ t.regra.rota }}</code>
                        <span v-if="rg.porId.value.get(t.regra.regra.id)" class="text-gray-500">
                          · {{ rg.porId.value.get(t.regra.regra.id)!.fonte }}
                        </span>
                      </p>
                      <p v-if="rg.porId.value.get(t.regra.regra.id)" class="text-gray-600 dark:text-gray-400">
                        Condição: {{ rg.porId.value.get(t.regra.regra.id)!.condicao }}
                      </p>
                      <p v-if="t.regra.declarada?.length" class="text-gray-600 dark:text-gray-400">
                        O cenário testa: {{ t.regra.declarada.map(rg.tituloRegra).join(' ou ') }}
                      </p>
                      <div v-if="camposDaRegra(t).length" class="flex flex-wrap gap-1 pt-1">
                        <code
                          v-for="[k, v] in camposDaRegra(t)"
                          :key="k"
                          class="rounded bg-white px-1.5 py-0.5 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
                        >{{ k }} = {{ v }}</code>
                      </div>
                      <p v-if="t.regra.aplicaveis.length > 1" class="text-gray-600 dark:text-gray-400">
                        O aluno também tem (o front não mostra; só chega nelas depois de resolver esta tela):
                        {{ t.regra.aplicaveis.slice(1).map(a => a.titulo).join('; ') }}
                      </p>
                      <p v-if="t.tipo === 'combinacao' && t.ajuste" class="text-gray-600 dark:text-gray-400">
                        Dado montado sobre a gravação de <code>{{ t.base }}</code>, com
                        <code>{{ Object.entries(t.ajuste).map(([k, v]) => `${k} = ${valorCampo(v)}`).join(', ') }}</code>
                      </p>
                      <p v-if="t.regra.avancos?.length" class="text-gray-600 dark:text-gray-400">
                        {{ textoAvancos(t.regra.avancos) }}
                      </p>
                      <p v-for="a in t.regra.avisos" :key="a" class="text-warning">
                        {{ a }}
                      </p>
                    </div>

                    <!-- O que o teste conferiu -->
                    <div v-if="t.verificacoes?.length" class="text-xs">
                      <p class="mb-1 font-medium">
                        O que o teste conferiu
                      </p>
                      <ul class="space-y-1">
                        <li v-for="(v, i) in t.verificacoes" :key="i" class="flex gap-2">
                          <UIcon :name="iconeVerificacao(v).nome" :class="['mt-0.5 size-4 shrink-0', iconeVerificacao(v).cor]" />
                          <div class="min-w-0">
                            <span class="mr-1 rounded bg-gray-200/70 px-1 text-[10px] uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">{{ TIPO_VERIFICACAO_E2E[v.tipo] }}</span>
                            {{ v.descricao }}
                            <span v-if="!v.ok && (v.esperado || v.obtido)" class="block font-mono text-gray-500">
                              <template v-if="v.esperado">esperado: {{ v.esperado }}</template>
                              <template v-if="v.esperado && v.obtido"> · </template>
                              <template v-if="v.obtido">obtido: {{ v.obtido }}</template>
                            </span>
                            <span v-if="!v.ok && v.erro" :class="['block', v.ressalva ? 'text-warning' : 'text-error']">{{ v.erro }}</span>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <details v-if="t.erro" class="text-xs">
                      <summary class="cursor-pointer text-gray-500">
                        Erro do Playwright
                      </summary>
                      <pre class="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-error">{{ t.erro }}</pre>
                    </details>
                    <div v-if="t.semGravacao.length" class="text-xs">
                      <p class="font-medium">
                        Chamadas sem gravação (no Vue 3, sinal de contrato de API diferente):
                      </p>
                      <ul class="mt-1 list-inside list-disc font-mono">
                        <li v-for="k in t.semGravacao" :key="k">
                          {{ k }}
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p v-else-if="exec.situacao === 'rodando'" class="text-sm text-gray-500">
          Abrindo o navegador…
        </p>
      </UCard>

      <details v-if="ex.dados.value?.estado.log.length" class="text-xs">
        <summary class="cursor-pointer text-gray-500">
          Saída do Playwright ({{ ex.dados.value.estado.log.length }} linhas)
        </summary>
        <pre class="mt-2 max-h-64 overflow-auto rounded bg-gray-50 p-2 leading-relaxed dark:bg-gray-800/60">{{ ex.dados.value.estado.log.join('\n') }}</pre>
      </details>
    </div>

    <p v-else-if="!ex.carregando.value" class="py-8 text-center text-sm text-gray-500">
      Nenhuma execução ainda. As execuções feitas com <code>cd e2e &amp;&amp; npm test</code> também aparecem aqui.
    </p>
  </div>
</template>
