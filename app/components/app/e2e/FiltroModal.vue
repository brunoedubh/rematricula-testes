<script setup lang="ts">
import type { CenarioE2e, DescarteE2e, FiltroCenarioE2e, PreviaFiltroE2e } from '~~/types'
import { COLUNAS_VIEW_E2E } from '~~/types'

/**
 * Filtro SQL de um cenário: o WHERE que a esteira usa para sortear alunos na sb_jira.wv_alunos_rem.
 * Edita o WHERE puro, mostra o SQL completo a cada alteração e conta no Databricks sob demanda.
 * Cenário manual que ganha um WHERE passa a ser buscado no Databricks.
 */
const props = defineProps<{
  cenario: CenarioE2e | null
  filtro: FiltroCenarioE2e | null
  descartados: DescarteE2e[]
  rodando: boolean
  /** PATCH do WHERE ('' remove); gerar = roda a esteira para o cenário em seguida */
  salvar: (where: string, gerar: boolean) => Promise<void>
}>()
const emit = defineEmits<{ fechar: [] }>()

const toast = useToast()
const where = ref('')
const original = ref('')
const previa = ref<PreviaFiltroE2e | null>(null)
const contando = ref(false)
const salvando = ref(false)
const erroSalvar = ref<string | null>(null)
const buscaColuna = ref('')
const campo = useTemplateRef<{ textareaRef?: HTMLTextAreaElement }>('campo')

const open = computed({
  get: () => !!props.cenario,
  set: (v) => {
    if (!v) emit('fechar')
  }
})

const manual = computed(() => props.cenario?.fonte === 'manual')
const alterado = computed(() => where.value.trim() !== original.value.trim())
const valido = computed(() => !!where.value.trim() && !!previa.value?.sql && !erroDeWhere.value)
/** Erro de validação do WHERE (o de contagem no Databricks não impede salvar) */
const erroDeWhere = computed(() => previa.value?.erro && !previa.value.erro.startsWith('Databricks') ? previa.value.erro : null)

/** Chaves do perfil que não são colunas: continuam como descrição do cenário */
const descricoes = computed(() => {
  const colunas = new Set(COLUNAS_VIEW_E2E.map(c => c.coluna))
  return descreverPerfil(Object.fromEntries(Object.entries(props.cenario?.perfil ?? {}).filter(([k]) => !colunas.has(k))))
})

const colunasVisiveis = computed(() => {
  const q = buscaColuna.value.trim().toLowerCase()
  return COLUNAS_VIEW_E2E.filter(c => !q || c.coluna.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q))
})

async function atualizarPrevia(contar = false) {
  if (!props.cenario) return
  if (!where.value.trim()) {
    previa.value = null
    return
  }
  if (contar) contando.value = true
  try {
    previa.value = await $fetch<PreviaFiltroE2e>('/api/e2e/filtro', {
      method: 'POST',
      body: { where: where.value, id: props.cenario.id, contar }
    })
  } catch (e) {
    previa.value = { fonte: 'databricks', erro: mensagemDeErro(e, 'Não foi possível montar o SQL') }
  } finally {
    contando.value = false
  }
}
const previaAtrasada = useDebounceFn(() => atualizarPrevia(false), 400)

watch(() => props.cenario, (c) => {
  if (!c) return
  original.value = props.filtro?.where ?? ''
  where.value = original.value
  previa.value = null
  erroSalvar.value = null
  buscaColuna.value = ''
  atualizarPrevia(false)
}, { immediate: true })

watch(where, () => previaAtrasada())

/** Insere o exemplo da coluna no fim do WHERE (com AND quando já tem algo). */
function inserir(exemplo: string) {
  where.value = where.value.trim() ? `${where.value.trimEnd()}\nAND ${exemplo}` : exemplo
  nextTick(() => campo.value?.textareaRef?.focus())
}

async function enviar(gerar: boolean, remover = false) {
  salvando.value = true
  erroSalvar.value = null
  try {
    await props.salvar(remover ? '' : where.value, gerar)
    emit('fechar')
  } catch (e) {
    erroSalvar.value = mensagemDeErro(e, 'Não foi possível salvar o filtro')
  } finally {
    salvando.value = false
  }
}

function copiarSql() {
  if (!previa.value?.sql) return
  navigator.clipboard?.writeText(previa.value.sql)
  toast.add({ title: 'SQL copiado', color: 'success', duration: 1500 })
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="cenario ? `Filtro SQL: ${cenario.titulo}` : 'Filtro SQL'"
    description="O WHERE que a esteira usa para sortear alunos na sb_jira.wv_alunos_rem (foto de produção D-1; o HML vira na segunda)."
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <div v-if="cenario" class="space-y-4">
        <UAlert
          v-if="manual"
          color="info"
          variant="soft"
          icon="i-lucide-info"
          title="Cenário manual"
          description="Hoje alguém precisa informar o aluno. Se escrever um WHERE e salvar, o cenário passa a ser buscado no Databricks (botão Gerar)."
        />

        <div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div class="space-y-3">
            <UFormField label="WHERE" :error="erroDeWhere ?? undefined">
              <UTextarea
                ref="campo"
                v-model="where"
                class="w-full font-mono text-sm"
                :rows="6"
                autoresize
                spellcheck="false"
                placeholder="IND_MEDICINA = 'S'
AND COD_PERIODO_LETIVO IN (13168, 13169)"
              />
            </UFormField>
            <p v-if="descricoes.length" class="text-xs text-gray-500">
              Descrição do cenário (não entra no SQL): {{ descricoes.join(' · ') }}
            </p>

            <div>
              <div class="mb-1 flex items-center justify-between">
                <span class="text-sm font-medium">SQL que a esteira vai rodar</span>
                <div class="flex gap-1">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    :disabled="!previa?.sql"
                    @click="copiarSql"
                  >
                    Copiar
                  </UButton>
                  <UButton
                    size="xs"
                    variant="soft"
                    icon="i-lucide-hash"
                    :loading="contando"
                    :disabled="!where.trim() || !!erroDeWhere"
                    @click="atualizarPrevia(true)"
                  >
                    Contar alunos
                  </UButton>
                </div>
              </div>
              <pre class="max-h-56 overflow-auto rounded bg-gray-50 p-3 text-xs leading-relaxed dark:bg-gray-800/60">{{ previa?.sql ?? (where.trim() ? '…' : 'Escreva o WHERE acima.') }}</pre>
              <UAlert
                v-if="previa?.erro && !erroDeWhere"
                class="mt-2"
                color="warning"
                variant="soft"
                icon="i-lucide-circle-alert"
                :title="previa.erro"
              />
              <p v-else-if="previa?.total !== undefined" class="mt-2 text-sm">
                <strong>{{ previa.total.toLocaleString('pt-BR') }}</strong> aluno(s) na view com este filtro.
                <span v-if="previa.amostra?.length" class="text-gray-500">
                  Amostra: <span class="font-mono">{{ previa.amostra.join(', ') }}</span>
                </span>
              </p>
              <p v-if="descartados.length" class="mt-2 text-xs text-gray-500">
                Os {{ descartados.length }} aluno(s) descartado(s) deste cenário entram sozinhos no fim (<span class="font-mono">COD_ALUNO NOT IN</span>).
              </p>
            </div>
          </div>

          <!-- Colunas da view -->
          <div class="space-y-2">
            <div class="text-sm font-medium">
              Colunas da view
            </div>
            <p class="text-xs text-gray-500">
              Só estas colunas são aceitas. Clique para incluir um exemplo no WHERE.
            </p>
            <UInput v-model="buscaColuna" size="sm" icon="i-lucide-search" placeholder="Filtrar colunas" class="w-full" />
            <ul class="max-h-80 space-y-1 overflow-auto pr-1">
              <li v-for="c in colunasVisiveis" :key="c.coluna">
                <button
                  type="button"
                  class="w-full rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                  :title="`Incluir: ${c.exemplo}`"
                  @click="inserir(c.exemplo)"
                >
                  <div class="font-mono text-xs font-medium">
                    {{ c.coluna }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ c.descricao }}
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <UAlert v-if="erroSalvar" color="error" variant="soft" icon="i-lucide-circle-alert" :title="erroSalvar" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton
          v-if="cenario?.where"
          color="neutral"
          variant="ghost"
          icon="i-lucide-eraser"
          :loading="salvando"
          title="Tira o WHERE: o cenário volta a usar o perfil antigo, ou vira manual se não tiver"
          @click="enviar(false, true)"
        >
          Remover WHERE
        </UButton>
        <span v-else />
        <div class="flex flex-wrap gap-2">
          <UButton color="neutral" variant="outline" @click="emit('fechar')">
            Fechar
          </UButton>
          <UButton
            variant="outline"
            :loading="salvando"
            :disabled="!alterado || !valido"
            @click="enviar(false)"
          >
            Salvar filtro
          </UButton>
          <UButton
            icon="i-lucide-play"
            :loading="salvando"
            :disabled="!valido || rodando"
            @click="enviar(true)"
          >
            {{ alterado ? 'Salvar e gerar' : 'Gerar com este filtro' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
