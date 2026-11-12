<script setup lang="ts">
import type { ArquivosCenarioE2e, CandidatoGravadoE2e, CenarioE2e, EstadoEsteiraE2e, ResultadoCenarioE2e } from '~~/types'

/**
 * Aba Cenários, visão "Precisam de ação" (e2e/PLANO.md 4): cenários que só andam com alguém informando o aluno
 * (nao-encontrado, divergente, manuais sem gravação) e gravações a-confirmar esperando conferência.
 */
const props = defineProps<{
  cenarios: CenarioE2e[]
  arquivos: Record<string, ArquivosCenarioE2e>
  esteira: EstadoEsteiraE2e | null
  rodando: boolean
  /** Cenário aberto pelo "Resolver" da lista: ganha destaque */
  destaque?: string | null
  gravar: (id: string, codigoAluno: number, liberar: boolean) => Promise<{ resultado?: ResultadoCenarioE2e, erro?: string }>
}>()
const emit = defineEmits<{
  confirmar: [cenario: CenarioE2e]
  aPartirDe: [origem: OrigemGravacao]
  captura: [caminho: string, titulo: string]
  descartar: [cenario: string, codigoAluno: number]
  filtro: [cenario: CenarioE2e]
}>()

const aConfirmar = computed(() => props.cenarios.filter(c => c.status === 'a-confirmar'))
const semAluno = computed(() => props.cenarios.filter(precisaDeAluno))

// Formulário de cada cartão
const codigo = reactive<Record<string, string>>({})
const liberar = reactive<Record<string, boolean>>({})
const gravandoId = ref<string | null>(null)
const ultimo = reactive<Record<string, { resultado?: ResultadoCenarioE2e, erro?: string }>>({})

watch(() => props.cenarios, (lista) => {
  for (const c of lista) {
    if (!(c.id in liberar)) liberar[c.id] = liberarPorPadrao(c)
  }
}, { immediate: true })

const codigoValido = (id: string) => /^\d{1,12}$/.test((codigo[id] ?? '').trim())

async function gravarAluno(c: CenarioE2e) {
  if (!codigoValido(c.id)) return
  gravandoId.value = c.id
  ultimo[c.id] = {}
  try {
    ultimo[c.id] = await props.gravar(c.id, Number(codigo[c.id]), liberar[c.id] ?? true)
  } finally {
    gravandoId.value = null
  }
}

/** Rota onde cada candidato parou (da execução atual da esteira ou da última gravação nesta tela). */
const rotas = computed(() => {
  const mapa = new Map<string, string>()
  const resultados = [...(props.esteira?.resultados ?? []), ...Object.values(ultimo).map(u => u.resultado).filter(Boolean)] as ResultadoCenarioE2e[]
  for (const r of resultados) {
    for (const t of r.tentativas) {
      if (t.rota !== undefined) mapa.set(`${r.id}--${t.codigoAluno}`, t.rota)
    }
  }
  return mapa
})

/** Rota anotada no HAR pelo gravador; HAR antigo: a da esteira em memória. */
function rotaDoCandidato(c: CenarioE2e, cand: CandidatoGravadoE2e): string | undefined {
  return cand.rota ?? rotas.value.get(`${c.id}--${cand.codigoAluno}`)
}

function todosForaDoPeriodo(c: CenarioE2e): boolean {
  const cands = props.arquivos[c.id]?.candidatos ?? []
  return cands.length > 0 && cands.every(x => x.resultado === 'fora-do-periodo' || /rematriculaNaoIniciada/i.test(rotaDoCandidato(c, x) ?? ''))
}

function origem(c: CenarioE2e, cand: CandidatoGravadoE2e): OrigemGravacao {
  return { cenario: c.id, codigoAluno: cand.codigoAluno, captura: cand.captura, rota: rotaDoCandidato(c, cand), regra: cand.regra }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-600 dark:text-gray-400">
      Informe o código de um aluno que você sabe que está no caso. A esteira libera, grava e confere a tela.
    </p>

    <!-- A confirmar -->
    <section v-if="aConfirmar.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Gravados, falta conferir a tela ({{ aConfirmar.length }})
      </h2>
      <div class="grid gap-3 md:grid-cols-2">
        <UCard
          v-for="c in aConfirmar"
          :id="`pendente-${c.id}`"
          :key="c.id"
          :ui="{ body: 'space-y-2' }"
          class="scroll-mt-4 transition-shadow"
          :class="destaque === c.id ? 'ring-2 ring-primary' : ''"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-medium">
                {{ c.titulo }}
              </div>
              <div class="font-mono text-xs text-gray-500">
                {{ c.id }}
              </div>
            </div>
            <UBadge :color="STATUS_E2E[c.status].cor" variant="subtle">
              {{ STATUS_E2E[c.status].rotulo }}
            </UBadge>
          </div>
          <p class="text-sm">
            Aluno <span class="font-mono">{{ arquivos[c.id]?.codigoAluno ?? '?' }}</span>
            parou em <span class="font-mono">{{ c.observado?.rota || '(raiz)' }}</span>
          </p>
          <p class="text-xs text-gray-500">
            Este cenário não tem tela esperada, então a esteira aceitou o primeiro aluno que abriu numa tela da jornada.
            Se a captura for a tela do cenário, confirme; se não, edite o perfil ou informe outro aluno abaixo.
          </p>
          <button
            v-if="arquivos[c.id]?.captura"
            type="button"
            class="block w-full"
            @click="emit('captura', arquivos[c.id]!.captura!, c.titulo)"
          >
            <img
              :src="urlCaptura(arquivos[c.id]!.captura!, c.gravadoEm)"
              :alt="`Captura: ${c.titulo}`"
              class="h-40 w-full rounded border border-gray-200 object-cover object-top dark:border-gray-800"
            >
          </button>
          <div class="flex gap-2">
            <UButton icon="i-lucide-check" class="flex-1 justify-center" @click="emit('confirmar', c)">
              Conferir e confirmar
            </UButton>
            <UButton
              v-if="arquivos[c.id]?.codigoAluno"
              color="error"
              variant="soft"
              icon="i-lucide-trash-2"
              :disabled="rodando"
              @click="emit('descartar', c.id, arquivos[c.id]!.codigoAluno!)"
            >
              Descartar aluno
            </UButton>
          </div>
        </UCard>
      </div>
    </section>

    <!-- Precisam de aluno -->
    <section class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Precisam de um aluno ({{ semAluno.length }})
      </h2>
      <p v-if="!semAluno.length" class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
        Nenhum cenário esperando aluno.
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <UCard
          v-for="c in semAluno"
          :id="`pendente-${c.id}`"
          :key="c.id"
          :ui="{ body: 'space-y-3' }"
          class="scroll-mt-4 transition-shadow"
          :class="destaque === c.id ? 'ring-2 ring-primary' : ''"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-medium">
                {{ c.titulo }}
              </div>
              <div class="font-mono text-xs text-gray-500">
                {{ c.id }}
              </div>
            </div>
            <div class="flex flex-col items-end gap-1">
              <UBadge :color="STATUS_E2E[c.status].cor" variant="subtle">
                {{ STATUS_E2E[c.status].rotulo }}
              </UBadge>
              <span class="text-xs text-gray-500">{{ c.fonte === 'databricks' ? 'Databricks' : 'Manual' }}</span>
            </div>
          </div>

          <div>
            <div class="mb-1 text-xs text-gray-500">
              Aluno esperado
            </div>
            <code v-if="c.where" class="mb-1 block whitespace-pre-wrap break-words rounded bg-gray-50 px-1.5 py-1 text-xs dark:bg-gray-800/60">{{ c.where }}</code>
            <ul class="list-inside list-disc text-sm">
              <li v-for="(frase, i) in descreverPerfil(c.perfil)" :key="i">
                {{ frase }}
              </li>
            </ul>
            <p v-if="c.esperado?.rota" class="mt-1 text-xs text-gray-500">
              Tela esperada: <span class="font-mono">{{ c.esperado.rota }}</span>
            </p>
            <UButton
              size="xs"
              variant="link"
              icon="i-lucide-database"
              class="px-0"
              @click="emit('filtro', c)"
            >
              {{ c.fonte === 'databricks' ? 'Ver / editar filtro SQL' : 'Buscar no Databricks (escrever WHERE)' }}
            </UButton>
          </div>

          <p v-if="c.observado?.rotas?.length" class="text-sm text-error">
            Os candidatos abriram em: <span class="font-mono">{{ c.observado.rotas.map(r => r || '(raiz)').join(', ') }}</span>
          </p>
          <UAlert
            v-if="c.observado?.motivo"
            color="warning"
            variant="soft"
            icon="i-lucide-info"
            :title="c.observado.motivo"
            :description="todosForaDoPeriodo(c) ? 'Por isso as capturas são iguais: todas mostram “Estamos fora do período de rematrícula”. A view do Databricks é a foto de produção; em HML o aluno pode estar em outro período letivo, e a liberação feita com os dados da view não vale para ele. A esteira agora tenta de novo com a combinação que o HML devolve.' : undefined"
          />

          <!-- Gravações dos candidatos que não foram aprovados -->
          <div v-if="arquivos[c.id]?.candidatos.length" class="space-y-1">
            <div class="text-xs text-gray-500">
              Gravações dos candidatos
            </div>
            <div
              v-for="cand in arquivos[c.id]!.candidatos"
              :key="cand.codigoAluno"
              class="flex flex-wrap items-center gap-2 text-sm"
            >
              <span class="font-mono">{{ cand.codigoAluno }}</span>
              <UBadge
                v-if="cand.resultado"
                :color="RESULTADO_TENTATIVA[cand.resultado].cor"
                variant="outline"
                size="xs"
                :title="AJUDA_RESULTADO[cand.resultado]"
              >
                {{ RESULTADO_TENTATIVA[cand.resultado].rotulo }}
              </UBadge>
              <span v-if="rotaDoCandidato(c, cand) !== undefined" class="font-mono text-xs text-gray-500">
                {{ rotaDoCandidato(c, cand) || '(raiz)' }}
              </span>
              <span v-if="cand.aluno" class="w-full pl-1 text-xs text-gray-500">
                {{ descreverAlunoHml(cand.aluno) }}
              </span>
              <span v-if="cand.regra" class="w-full pl-1 text-xs text-gray-600 dark:text-gray-400" :title="`Regra de tela que o dado do aluno aciona: ${cand.regra.rota}`">
                <UIcon name="i-lucide-scale" class="mr-0.5 align-text-bottom" />{{ cand.regra.titulo }}
                <template v-if="cand.regra.aplicaveis.length > 1"> (também valiam: {{ cand.regra.aplicaveis.slice(1).join(', ') }})</template>
              </span>
              <UButton
                v-if="cand.captura"
                size="xs"
                variant="link"
                icon="i-lucide-image"
                @click="emit('captura', cand.captura, `${c.id} · aluno ${cand.codigoAluno}`)"
              >
                Captura
              </UButton>
              <UButton
                v-if="cand.gravacao"
                size="xs"
                variant="link"
                icon="i-lucide-file-plus"
                :disabled="rodando"
                @click="emit('aPartirDe', origem(c, cand))"
              >
                Criar cenário a partir desta gravação
              </UButton>
              <UButton
                size="xs"
                variant="link"
                color="error"
                icon="i-lucide-trash-2"
                :disabled="rodando"
                @click="emit('descartar', c.id, cand.codigoAluno)"
              >
                Descartar
              </UButton>
            </div>
          </div>

          <form class="flex flex-wrap items-end gap-2" @submit.prevent="gravarAluno(c)">
            <UFormField label="Código do aluno" class="min-w-0 flex-1">
              <UInput
                v-model="codigo[c.id]"
                inputmode="numeric"
                placeholder="Ex.: 1234567"
                class="w-full font-mono"
                :disabled="rodando"
              />
            </UFormField>
            <UButton
              type="submit"
              icon="i-lucide-circle-dot"
              :loading="gravandoId === c.id"
              :disabled="rodando || !codigoValido(c.id)"
            >
              Gravar
            </UButton>
            <USwitch
              v-model="liberar[c.id]"
              label="Liberar no soft launch"
              description="Desligue para cenários fora do prazo"
              :disabled="rodando"
              class="w-full"
            />
          </form>

          <!-- Resultado da última gravação nesta tela -->
          <UAlert
            v-if="ultimo[c.id]?.erro"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="ultimo[c.id]!.erro"
          />
          <div v-else-if="ultimo[c.id]?.resultado" class="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
            <div class="flex items-center gap-2">
              Resultado:
              <UBadge :color="STATUS_E2E[ultimo[c.id]!.resultado!.status].cor" variant="subtle">
                {{ STATUS_E2E[ultimo[c.id]!.resultado!.status].rotulo }}
              </UBadge>
            </div>
            <div
              v-for="t in ultimo[c.id]!.resultado!.tentativas"
              :key="t.codigoAluno"
              class="mt-1 flex flex-wrap items-center gap-2 text-xs"
            >
              <UBadge :color="RESULTADO_TENTATIVA[t.resultado].cor" variant="outline" size="xs" :title="AJUDA_RESULTADO[t.resultado]">
                {{ RESULTADO_TENTATIVA[t.resultado].rotulo }}
              </UBadge>
              <span v-if="t.rota !== undefined" class="font-mono">{{ t.rota || '(raiz)' }}</span>
              <span v-if="t.motivo">{{ t.motivo }}</span>
              <span v-if="t.avancos?.length" :title="textoAvancos(t.avancos)">avançou: {{ t.avancos.join(', ') }}</span>
              <UButton
                v-if="t.png"
                size="xs"
                variant="link"
                icon="i-lucide-image"
                @click="emit('captura', t.png, `${c.id} · aluno ${t.codigoAluno}`)"
              >
                Captura
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
