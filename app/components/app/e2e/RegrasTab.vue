<script setup lang="ts">
import type { ArquivosCenarioE2e, CenarioE2e, CombinacaoE2e, RegraE2e, TesteExecucaoE2e } from '~~/types'

/**
 * Aba Cobertura (e2e/PLANO.md 3.5): as regras de tela do front em ordem de prioridade (oráculo
 * e2e/regras/regras.mjs) e o que testa cada uma. Cobertura por REGRA, e não por cenário gravado:
 * - cenário real: aluno do HML gravado, conferido contra a regra;
 * - combinação: dado montado sobre uma gravação, para testar a prioridade entre regras.
 */
const props = defineProps<{
  cenarios: CenarioE2e[]
  arquivos: Record<string, ArquivosCenarioE2e>
}>()

const rg = useRegrasE2e()
onMounted(() => {
  void rg.carregar()
})

const combinacoes = computed(() => rg.dados.value?.combinacoes ?? [])
const executaveis = computed(() => new Set(rg.dados.value?.combinacoesExecutaveis ?? []))
const ultima = computed(() => rg.dados.value?.ultimaExecucao)

const regrasDe = (c: CenarioE2e): string[] => [c.regra ?? []].flat()

/** "#9 Contrato liberado e não aceito": a posição na prioridade explica quem vence a combinação */
function comOrdem(id: string): string {
  const ordem = rg.porId.value.get(id)?.ordem
  return ordem ? `#${ordem} ${rg.tituloRegra(id)}` : rg.tituloRegra(id)
}
/** Regras da combinação em ordem de prioridade (a primeira é a que deve vencer, salvo desvio) */
function emOrdem(ids: string[]): string[] {
  return [...ids].sort((a, b) => (rg.porId.value.get(a)?.ordem ?? 99) - (rg.porId.value.get(b)?.ordem ?? 99))
}

/** Testes da última execução cuja regra decisiva (oráculo) é esta */
function testesDaRegra(id: string): TesteExecucaoE2e[] {
  return (ultima.value?.testes ?? []).filter(t => t.regra?.regra.id === id)
}

interface LinhaRegra {
  regra: RegraE2e
  /** Cenários do catálogo que declaram a regra */
  cenarios: CenarioE2e[]
  /** Combinações em que a regra deve vencer */
  vence: CombinacaoE2e[]
  /** Combinações em que a regra participa mas não vence */
  participa: CombinacaoE2e[]
  testes: TesteExecucaoE2e[]
  cobertura: 'real' | 'combinacao' | 'pendente' | 'nenhuma'
}

const linhas = computed<LinhaRegra[]>(() => rg.regras.value.map((regra) => {
  const cenarios = props.cenarios.filter(c => regrasDe(c).includes(regra.id))
  const vence = combinacoes.value.filter(c => c.regra === regra.id)
  const participa = combinacoes.value.filter(c => c.regra !== regra.id && c.combina.includes(regra.id))
  const real = cenarios.some(c => c.status === 'gravado' && props.arquivos[c.id]?.gravacao)
  const cobertura: LinhaRegra['cobertura'] = real
    ? 'real'
    : vence.some(c => executaveis.value.has(c.id)) ? 'combinacao' : cenarios.length ? 'pendente' : 'nenhuma'
  return { regra, cenarios, vence, participa, testes: testesDaRegra(regra.id), cobertura }
}))

const COBERTURA = {
  real: { rotulo: 'Aluno real', cor: 'success', ajuda: 'Um aluno do HML gravado cai nesta regra e o teste confere a tela' },
  combinacao: { rotulo: 'Só dado montado', cor: 'info', ajuda: 'Testada só por combinação (dado ajustado sobre outra gravação): confere a decisão do front, mas não há aluno real' },
  pendente: { rotulo: 'Sem gravação', cor: 'warning', ajuda: 'Há cenário para esta regra, mas ainda sem aluno gravado' },
  nenhuma: { rotulo: 'Sem teste', cor: 'error', ajuda: 'Nenhum cenário nem combinação testa esta regra' }
} as const

const resumo = computed(() => {
  const r = { real: 0, combinacao: 0, pendente: 0, nenhuma: 0 }
  for (const l of linhas.value) r[l.cobertura]++
  return r
})

const semRegra = computed(() => props.cenarios.filter(c => !regrasDe(c).length))

function situacaoTestes(testes: TesteExecucaoE2e[]): { rotulo: string, cor: 'success' | 'error' | 'warning' | 'neutral' } | null {
  if (!testes.length) return null
  const falhou = testes.filter(t => t.situacao === 'falhou').length
  const massa = testes.filter(t => t.situacao === 'massa-invalida').length
  const passou = testes.filter(t => t.situacao === 'passou').length
  if (falhou) return { rotulo: `${falhou} falha(s)`, cor: 'error' }
  if (massa) return { rotulo: `${massa} massa inválida`, cor: 'warning' }
  if (passou) return { rotulo: `${passou} passou`, cor: 'success' }
  return { rotulo: 'pulado', cor: 'neutral' }
}

/** Último resultado de uma combinação (pior entre os dispositivos) */
function resultadoCombinacao(id: string) {
  return situacaoTestes((ultima.value?.testes ?? []).filter(t => t.cenario === id))
}

const corStatus = (c: CenarioE2e) => STATUS_E2E[c.status].cor
const dataHora = (iso?: string) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="rg.erro.value"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="rg.erro.value"
    />

    <p class="text-sm text-gray-600 dark:text-gray-400">
      As regras que o front usa para escolher a tela do aluno, na ordem em que ele avalia: a primeira que vale decide.
      Os testes conferem a tela contra estas regras, a partir do dado que o aluno recebeu da API.
      <span class="text-gray-500">Fonte: <code>GerenciadorRotasPrioritarias.ts</code>, espelhado em <code>e2e/regras/regras.mjs</code>.</span>
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <UBadge
        v-for="(n, k) in resumo"
        :key="k"
        :color="COBERTURA[k].cor"
        variant="subtle"
        size="lg"
        :title="COBERTURA[k].ajuda"
      >
        {{ COBERTURA[k].rotulo }}: {{ n }}
      </UBadge>
      <span class="text-xs text-gray-500">
        de {{ linhas.length }} regras
        <template v-if="ultima"> · resultados da execução de {{ dataHora(ultima.inicio) }}</template>
      </span>
      <UButton
        class="ml-auto"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-refresh-cw"
        :loading="rg.carregando.value"
        aria-label="Atualizar regras"
        @click="rg.carregar()"
      />
    </div>

    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table class="w-full min-w-[860px] text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
          <tr>
            <th class="w-10 px-3 py-2">
              #
            </th>
            <th class="px-3 py-2">
              Regra e condição
            </th>
            <th class="px-3 py-2">
              Tela
            </th>
            <th class="px-3 py-2">
              Testada por
            </th>
            <th class="px-3 py-2">
              Última execução
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="l in linhas" :key="l.regra.id" class="align-top">
            <td class="px-3 py-2 tabular-nums text-gray-500">
              {{ l.regra.ordem }}
            </td>
            <td class="px-3 py-2">
              <div class="font-medium">
                {{ l.regra.titulo }}
              </div>
              <p class="mt-0.5 max-w-md text-xs text-gray-600 dark:text-gray-400">
                {{ l.regra.condicao }}
              </p>
              <p class="mt-0.5 font-mono text-[11px] text-gray-400">
                {{ l.regra.id }} · {{ l.regra.fonte }}
              </p>
            </td>
            <td class="px-3 py-2 font-mono text-xs">
              {{ l.regra.rota }}
            </td>
            <td class="px-3 py-2">
              <UBadge :color="COBERTURA[l.cobertura].cor" variant="subtle" size="sm" :title="COBERTURA[l.cobertura].ajuda">
                {{ COBERTURA[l.cobertura].rotulo }}
              </UBadge>
              <div class="mt-1 flex max-w-xs flex-wrap gap-1">
                <UBadge
                  v-for="c in l.cenarios"
                  :key="c.id"
                  :color="corStatus(c)"
                  variant="outline"
                  size="sm"
                  class="font-normal"
                  :title="`Cenário ${c.id}: ${STATUS_E2E[c.status].rotulo}`"
                >
                  {{ c.titulo }}
                </UBadge>
                <UBadge
                  v-for="c in l.vence"
                  :key="c.id"
                  color="info"
                  variant="outline"
                  size="sm"
                  class="font-normal"
                  :title="`Combinação ${c.id}: esta regra deve vencer ${c.combina.filter(x => x !== l.regra.id).map(rg.tituloRegra).join(', ') || 'as outras'}`"
                >
                  <UIcon name="i-lucide-git-merge" class="size-3" />
                  {{ c.titulo }}
                </UBadge>
              </div>
              <p v-if="l.participa.length" class="mt-1 text-xs text-gray-500">
                Perde para outra regra em: {{ l.participa.map(c => c.titulo).join('; ') }}
              </p>
            </td>
            <td class="px-3 py-2">
              <UBadge
                v-if="situacaoTestes(l.testes)"
                :color="situacaoTestes(l.testes)!.cor"
                variant="subtle"
                size="sm"
              >
                {{ situacaoTestes(l.testes)!.rotulo }}
              </UBadge>
              <span v-else class="text-xs text-gray-400">—</span>
              <p v-if="l.testes.length" class="mt-1 text-xs text-gray-500">
                {{ [...new Set(l.testes.map(t => t.cenario))].join(', ') }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UCard v-if="combinacoes.length" :ui="{ body: 'space-y-2' }">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-git-merge" />
          <span class="font-medium">Combinações de regras</span>
          <span class="text-xs text-gray-500">e2e/cenarios/combinacoes.json</span>
        </div>
      </template>
      <p class="text-xs text-gray-600 dark:text-gray-400">
        O aluno tem duas ou mais condições ao mesmo tempo, e o front escolhe a tela pela prioridade: vence o menor número (#) da tabela acima.
        O dado é montado sobre a gravação de um cenário (só o <code>ObterInformacoesAluno</code> muda): testa a decisão do front, não um aluno real.
        Rodam junto com os cenários na aba Execução.
      </p>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead class="text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="py-1 pr-3">
                Combinação
              </th>
              <th class="py-1 pr-3">
                Dado ajustado
              </th>
              <th class="py-1 pr-3">
                Deve vencer
              </th>
              <th class="py-1">
                Última execução
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="c in combinacoes" :key="c.id" class="align-top">
              <td class="py-2 pr-3">
                <div class="font-medium">
                  {{ c.titulo }}
                </div>
                <div class="font-mono text-xs text-gray-500">
                  {{ c.id }} · base: {{ c.base }}
                </div>
                <div v-if="!executaveis.has(c.id)" class="text-xs text-warning">
                  sem a gravação base nesta máquina
                </div>
              </td>
              <td class="py-2 pr-3">
                <code class="text-xs">{{ Object.entries(c.ajuste).map(([k, v]) => `${k} = ${valorCampo(v)}`).join(', ') }}</code>
                <p class="mt-1 text-xs text-gray-500">
                  Valem: {{ emOrdem(c.combina).map(comOrdem).join(' · ') }}
                </p>
              </td>
              <td class="py-2 pr-3">
                <div class="text-xs font-medium">
                  {{ comOrdem(c.regra) }}
                </div>
                <div class="font-mono text-xs text-gray-500">
                  {{ rg.porId.value.get(c.regra)?.rota }}
                </div>
              </td>
              <td class="py-2">
                <UBadge
                  v-if="resultadoCombinacao(c.id)"
                  :color="resultadoCombinacao(c.id)!.cor"
                  variant="subtle"
                  size="sm"
                >
                  {{ resultadoCombinacao(c.id)!.rotulo }}
                </UBadge>
                <span v-else class="text-xs text-gray-400">não rodou</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UAlert
      v-if="semRegra.length"
      color="warning"
      variant="soft"
      icon="i-lucide-scale"
      title="Cenários sem regra definida"
      :description="`${semRegra.map(c => c.titulo).join('; ')}. Sem regra, o teste só repete a gravação e não diz se a tela está certa. Defina em Editar.`"
    />
  </div>
</template>
