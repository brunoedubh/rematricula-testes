<script setup lang="ts">
import type { ArquivosCenarioE2e, CenarioE2e, EstadoEsteiraE2e, ResultadoCenarioE2e } from '~~/types'

/**
 * Aba "Não encontrados" (e2e/PLANO.md 4): cenários que só andam com alguém informando o aluno
 * (nao-encontrado, divergente, manuais sem gravação) e gravações a-confirmar esperando conferência.
 */
const props = defineProps<{
  cenarios: CenarioE2e[]
  arquivos: Record<string, ArquivosCenarioE2e>
  esteira: EstadoEsteiraE2e | null
  rodando: boolean
  gravar: (id: string, codigoAluno: number, liberar: boolean) => Promise<{ resultado?: ResultadoCenarioE2e, erro?: string }>
}>()
const emit = defineEmits<{
  novo: []
  confirmar: [cenario: CenarioE2e]
  aPartirDe: [origem: OrigemGravacao]
  captura: [caminho: string, titulo: string]
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

function origem(c: CenarioE2e, codigoAluno: number, captura?: string): OrigemGravacao {
  return { cenario: c.id, codigoAluno, captura, rota: rotas.value.get(`${c.id}--${codigoAluno}`) }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Informe o código de um aluno que você sabe que está no caso. A esteira libera, grava e confere a tela.
      </p>
      <UButton icon="i-lucide-plus" variant="outline" @click="emit('novo')">
        Novo cenário
      </UButton>
    </div>

    <!-- A confirmar -->
    <section v-if="aConfirmar.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Gravados, falta conferir a tela ({{ aConfirmar.length }})
      </h2>
      <div class="grid gap-3 md:grid-cols-2">
        <UCard v-for="c in aConfirmar" :key="c.id" :ui="{ body: 'space-y-2' }">
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
            Parou em <span class="font-mono">{{ c.observado?.rota || '(raiz)' }}</span>
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
          <UButton icon="i-lucide-check" block @click="emit('confirmar', c)">
            Conferir e confirmar
          </UButton>
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
        <UCard v-for="c in semAluno" :key="c.id" :ui="{ body: 'space-y-3' }">
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
            <ul class="list-inside list-disc text-sm">
              <li v-for="(frase, i) in descreverPerfil(c.perfil)" :key="i">
                {{ frase }}
              </li>
            </ul>
            <p v-if="c.esperado?.rota" class="mt-1 text-xs text-gray-500">
              Tela esperada: <span class="font-mono">{{ c.esperado.rota }}</span>
            </p>
          </div>

          <p v-if="c.observado?.rotas?.length" class="text-sm text-error">
            Os candidatos abriram em: <span class="font-mono">{{ c.observado.rotas.map(r => r || '(raiz)').join(', ') }}</span>
          </p>

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
              <span v-if="rotas.get(`${c.id}--${cand.codigoAluno}`) !== undefined" class="font-mono text-xs text-gray-500">
                {{ rotas.get(`${c.id}--${cand.codigoAluno}`) || '(raiz)' }}
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
                @click="emit('aPartirDe', origem(c, cand.codigoAluno, cand.captura))"
              >
                Criar cenário a partir desta gravação
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
              <UBadge :color="RESULTADO_TENTATIVA[t.resultado].cor" variant="outline" size="xs">
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
