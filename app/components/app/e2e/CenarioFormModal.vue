<script setup lang="ts">
import type { CenarioE2e, RegraGravacaoE2e } from '~~/types'

/**
 * Formulário de cenário (e2e/PLANO.md 4):
 * - novo: cenário que o catálogo não tem (sem gravação, entra como a-gravar)
 * - a-partir-de: usa a gravação de um candidato que caiu numa tela sem cenário
 * - editar: título e esperado
 * - confirmar: a-confirmar → gravado depois de conferir a captura
 *
 * A regra (e2e/regras/regras.mjs) diz em que tela o front DEVE parar: é ela que transforma o teste de
 * "repete a gravação" em "segue a regra". Confirmar exige regra, e o aluno gravado precisa cair nela.
 */
const props = defineProps<{
  aberto: boolean
  modo: ModoFormCenario
  cenario?: CenarioE2e | null
  origem?: OrigemGravacao | null
  /** Regra que o dado da gravação (do cenário ou do candidato) aciona */
  regraGravada?: RegraGravacaoE2e
  /** Chama a rota certa para o modo; erro sai como exceção */
  salvar: (corpo: Record<string, unknown>) => Promise<unknown>
}>()
const emit = defineEmits<{ fechar: [] }>()

const form = reactive({
  id: '',
  titulo: '',
  descricao: '',
  where: '',
  rota: '',
  textos: '',
  botoes: '',
  desabilitados: '',
  naoDeveTextos: '',
  naoDeveBotoes: '',
  regras: [] as string[]
})

const rg = useRegrasE2e()
onMounted(() => {
  if (!rg.dados.value) void rg.carregar()
})
const opcoesRegra = computed(() => rg.regras.value.map(r => ({ label: `${r.ordem}. ${r.titulo}`, value: r.id, description: r.rota })))

/** Escolheu a regra e a rota está vazia: sugere a tela da regra */
watch(() => form.regras, (ids) => {
  if (form.rota || ids.length !== 1) return
  const r = rg.porId.value.get(ids[0]!)
  if (r) form.rota = `^${sugerirRegexRota(r.rota)}$`
})

/** O aluno gravado cai numa regra que não está entre as escolhidas: o servidor recusa o confirmar */
const regraNaoBate = computed(() => !!props.regraGravada && form.regras.length > 0 && !form.regras.includes(props.regraGravada.id))
const idManual = ref(false)
const salvando = ref(false)
const erro = ref<string | null>(null)

const open = computed({
  get: () => props.aberto,
  set: (v) => {
    if (!v) emit('fechar')
  }
})

const criando = computed(() => props.modo === 'novo' || props.modo === 'a-partir-de')

const titulos: Record<ModoFormCenario, { titulo: string, descricao: string, botao: string }> = {
  'novo': { titulo: 'Novo cenário', descricao: 'Caso que alguém conhece e o catálogo ainda não tem. Entra como "a gravar".', botao: 'Criar cenário' },
  'a-partir-de': { titulo: 'Criar cenário a partir desta gravação', descricao: 'A gravação do candidato vira a gravação do cenário novo.', botao: 'Criar cenário' },
  'editar': { titulo: 'Editar cenário', descricao: 'Título e o que a tela deve mostrar.', botao: 'Salvar' },
  'confirmar': { titulo: 'Confirmar tela gravada', descricao: 'Confira a captura e preencha o que o teste deve conferir. O cenário passa a "gravado".', botao: 'Confirmar' }
}

const rotaObservada = computed(() => props.modo === 'a-partir-de' ? props.origem?.rota : props.cenario?.observado?.rota)
const captura = computed(() => props.modo === 'a-partir-de' ? props.origem?.captura : undefined)

watch(() => props.aberto, (aberto) => {
  if (!aberto) return
  erro.value = null
  idManual.value = false
  const c = props.cenario
  form.id = ''
  form.titulo = c?.titulo ?? ''
  form.descricao = ''
  form.where = ''
  form.rota = c?.esperado?.rota ?? ''
  form.textos = (c?.esperado?.textos ?? []).join('\n')
  form.botoes = (c?.esperado?.botoes ?? []).join('\n')
  form.desabilitados = (c?.esperado?.desabilitados ?? []).join('\n')
  form.naoDeveTextos = (c?.esperado?.naoDeve?.textos ?? []).join('\n')
  form.naoDeveBotoes = (c?.esperado?.naoDeve?.botoes ?? []).join('\n')
  form.regras = [c?.regra ?? []].flat()
  // Confirmando sem regra: a do aluno gravado é a sugestão (quem confirma decide se é a certa).
  if (!form.regras.length && props.modo === 'confirmar' && props.regraGravada) form.regras = [props.regraGravada.id]
  if (!form.rota && rotaObservada.value) form.rota = sugerirRegexRota(rotaObservada.value)
  if (props.modo === 'a-partir-de' && props.origem) {
    form.descricao = `gravado a partir de ${props.origem.cenario} (aluno informado)`
  }
})

watch(() => form.titulo, (t) => {
  if (criando.value && !idManual.value) form.id = idDoTitulo(t)
})

const linhas = (texto: string) => texto.split('\n').map(l => l.trim()).filter(Boolean)

/** A mesma conferência do servidor, para avisar antes de enviar. */
const rotaNaoCasa = computed(() => {
  if (!form.rota || rotaObservada.value === undefined) return false
  try {
    return !new RegExp(form.rota, 'i').test(`/${rotaObservada.value.replace(/^\/+/, '')}`)
  } catch {
    return true
  }
})

async function enviar() {
  erro.value = null
  const esperado = {
    rota: form.rota.trim() || undefined,
    textos: linhas(form.textos),
    botoes: linhas(form.botoes),
    desabilitados: linhas(form.desabilitados),
    naoDeve: { textos: linhas(form.naoDeveTextos), botoes: linhas(form.naoDeveBotoes) }
  }
  const regra = form.regras.length > 1 ? form.regras : (form.regras[0] ?? '')
  let corpo: Record<string, unknown>

  if (criando.value) {
    corpo = { id: form.id, titulo: form.titulo, descricao: form.descricao.trim() || undefined, where: form.where.trim() || undefined, esperado, regra: regra || undefined }
    if (props.modo === 'a-partir-de' && props.origem) {
      corpo.aPartirDe = { cenario: props.origem.cenario, codigoAluno: props.origem.codigoAluno, rota: props.origem.rota }
    }
  } else {
    corpo = { titulo: form.titulo, esperado, regra, confirmar: props.modo === 'confirmar' || undefined }
  }

  salvando.value = true
  try {
    await props.salvar(corpo)
    emit('fechar')
  } catch (e) {
    erro.value = mensagemDeErro(e, 'Não foi possível salvar')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="titulos[modo].titulo"
    :description="titulos[modo].descricao"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form id="form-cenario-e2e" class="space-y-4" @submit.prevent="enviar">
        <img
          v-if="captura"
          :src="urlCaptura(captura)"
          alt="Captura da gravação"
          class="max-h-64 w-full rounded border border-gray-200 object-cover object-top dark:border-gray-800"
        >

        <UFormField label="Título" required>
          <UInput v-model="form.titulo" class="w-full" placeholder="Ex.: Contrato liberado e não aceito" />
        </UFormField>

        <UFormField
          v-if="criando"
          label="Id"
          help="Nome do arquivo da gravação: letras minúsculas, números e hífen."
          required
        >
          <UInput v-model="form.id" class="w-full font-mono" @input="idManual = true" />
        </UFormField>

        <template v-if="criando">
          <UFormField label="Perfil do aluno (em texto)" help="Como reconhecer o caso. Cenário só com descrição é manual: precisa de alguém informando o aluno.">
            <UTextarea v-model="form.descricao" class="w-full" :rows="2" />
          </UFormField>
          <UFormField
            v-if="modo === 'novo'"
            label="WHERE no Databricks (opcional)"
            help="Ex.: IND_CONTRATO_LIBERADO = 'S' AND QTDE_DP_NA_MAT > 0. Com ele, a esteira procura alunos sozinha; sem ele, o cenário é manual. Dá para ajustar depois em Filtro SQL."
          >
            <UTextarea v-model="form.where" class="w-full font-mono text-xs" :rows="2" spellcheck="false" />
          </UFormField>
        </template>

        <UFormField
          label="Regra de tela que o cenário testa"
          help="Em ordem de prioridade, como o front decide (GerenciadorRotasPrioritarias). O teste confere que o aluno cai nesta regra e que o front para na tela dela."
          :required="modo === 'confirmar'"
          :error="regraNaoBate ? `O aluno gravado cai em: ${regraGravada!.titulo} (${regraGravada!.rota})` : undefined"
        >
          <USelectMenu
            v-model="form.regras"
            :items="opcoesRegra"
            value-key="value"
            multiple
            placeholder="Escolha a regra"
            class="w-full"
          />
        </UFormField>
        <p v-if="regraGravada && !regraNaoBate" class="-mt-2 text-xs text-gray-500">
          <UIcon name="i-lucide-user-check" class="mr-0.5 align-text-bottom" />
          O dado do aluno gravado aciona: {{ regraGravada.titulo }} → <code>{{ regraGravada.rota }}</code>
          <template v-if="regraGravada.aplicaveis.length > 1">
            (também valiam: {{ regraGravada.aplicaveis.slice(1).map(rg.tituloRegra).join('; ') }})
          </template>
        </p>

        <UFormField
          label="Rota esperada"
          :help="rotaObservada !== undefined ? `Expressão regular no caminho do app (ex.: ^/contrato$). A gravação parou em: ${rotaObservada || '(raiz)'}` : 'Expressão regular no caminho do app (ex.: ^/contrato$).'"
          :error="rotaNaoCasa ? 'Não casa com a tela gravada' : undefined"
          :required="modo === 'confirmar'"
        >
          <UInput v-model="form.rota" class="w-full font-mono" placeholder="Ex.: pendencia/financeira" />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Textos visíveis" help="Um por linha">
            <UTextarea v-model="form.textos" class="w-full" :rows="3" />
          </UFormField>
          <UFormField label="Botões" help="Nome do botão, um por linha">
            <UTextarea v-model="form.botoes" class="w-full" :rows="3" />
          </UFormField>
          <UFormField label="Não pode mostrar (textos)" help="Textos de outras telas que não podem aparecer aqui">
            <UTextarea v-model="form.naoDeveTextos" class="w-full" :rows="2" />
          </UFormField>
          <UFormField label="Botões desabilitados" help="Botões que precisam começar desabilitados (ex.: Aceitar contrato)">
            <UTextarea v-model="form.desabilitados" class="w-full" :rows="2" />
          </UFormField>
        </div>

        <UAlert v-if="erro" color="error" variant="soft" icon="i-lucide-circle-alert" :title="erro" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="emit('fechar')">
          Cancelar
        </UButton>
        <UButton
          type="submit"
          form="form-cenario-e2e"
          :loading="salvando"
          :disabled="!form.titulo || (criando && !form.id) || (modo === 'confirmar' && (!form.rota || !form.regras.length || regraNaoBate))"
        >
          {{ titulos[modo].botao }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
