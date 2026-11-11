<script setup lang="ts">
import type { ArquivosCenarioE2e, CenarioE2e, TesteExecucaoE2e } from '~~/types'

/**
 * Aba Execução (e2e/PLANO.md 5): escolhe alvo, dispositivos e cenários, roda a suíte e mostra
 * o resultado por cenário × dispositivo, com tela esperada × obtida, captura e trace.
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

/** Cenários que viram teste: gravados e com a gravação nesta máquina */
const executaveis = computed(() => props.cenarios.filter(c => c.status === 'gravado' && props.arquivos[c.id]?.gravacao))

const opcoesAlvo = computed(() => (ex.dados.value?.alvos ?? []).map(a => ({ label: a.rotulo, value: a.nome, description: a.url })))
const urlAlvo = computed(() => ex.dados.value?.alvos.find(a => a.nome === alvo.value)?.url)
const opcoesDispositivo = computed(() => (ex.dados.value?.dispositivos ?? ['desktop', 'mobile']).map(d => ({ label: d === 'desktop' ? 'Desktop' : 'Mobile', value: d })))

/** Cenários que falharam (ou ficaram instáveis) na execução selecionada */
const falhados = computed(() => [...new Set((ex.execucao.value?.testes ?? [])
  .filter(t => t.situacao === 'falhou' || t.situacao === 'instavel')
  .map(t => t.cenario))])

const opcoesEscopo = computed(() => [
  { label: `Todos os gravados (${executaveis.value.length})`, value: 'todos' },
  { label: `Só os que falharam na execução selecionada (${falhados.value.length})`, value: 'falhados', disabled: !falhados.value.length },
  { label: 'Escolher cenários', value: 'escolher' }
])
const opcoesCenario = computed(() => executaveis.value.map(c => ({ label: c.titulo, value: c.id, description: c.id })))

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

const ORDEM = { falhou: 0, instavel: 1, pulado: 2, passou: 3 } as const
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
const temDetalhe = (t: TesteExecucaoE2e) => !!t.erro || t.semGravacao.length > 0 || !!t.motivo

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
                  </td>
                  <td class="px-3 py-2">
                    <UIcon :name="t.dispositivo === 'mobile' ? 'i-lucide-smartphone' : 'i-lucide-monitor'" class="mr-1 size-4 align-text-bottom text-gray-500" />
                    {{ t.dispositivo }}
                  </td>
                  <td class="px-3 py-2">
                    <UBadge
                      :color="SITUACAO_TESTE_E2E[t.situacao].cor"
                      :icon="SITUACAO_TESTE_E2E[t.situacao].icone"
                      variant="subtle"
                    >
                      {{ SITUACAO_TESTE_E2E[t.situacao].rotulo }}
                    </UBadge>
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
                    <div class="text-gray-500">
                      {{ t.rotaEsperada ?? '—' }}
                    </div>
                    <div :class="rotaConfere(t) === false ? 'text-error' : ''">
                      {{ t.rotaObtida ?? '—' }}
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
                  <td colspan="6" class="space-y-2 bg-gray-50/60 px-3 py-2 dark:bg-gray-800/30">
                    <p v-if="t.motivo" class="text-xs text-gray-600 dark:text-gray-400">
                      {{ t.motivo }}
                    </p>
                    <pre v-if="t.erro" class="max-h-56 overflow-auto whitespace-pre-wrap text-xs text-error">{{ t.erro }}</pre>
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
