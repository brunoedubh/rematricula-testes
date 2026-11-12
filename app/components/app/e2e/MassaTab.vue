<script setup lang="ts">
import type { AlunoMassaE2e, CenarioMassaE2e, RespostaMassaE2e } from '~~/types'

/**
 * Aba "Massa de teste": código do aluno usado em cada cenário (aprovado) e dos candidatos tentados,
 * com o que o HML diz sobre ele (período, curso, persona, soft launch). Dados só da máquina local.
 */
defineProps<{ rodando: boolean }>()
const emit = defineEmits<{
  captura: [caminho: string, titulo: string]
  descartar: [cenario: string, codigoAluno: number]
  permitir: [cenario: string, codigoAluno: number]
}>()

const toast = useToast()
const dados = ref<RespostaMassaE2e | null>(null)
const carregando = ref(false)
const erro = ref<string | null>(null)
const busca = ref('')
const soAprovados = ref(false)

async function carregar() {
  carregando.value = true
  try {
    dados.value = await $fetch<RespostaMassaE2e>('/api/e2e/massa')
    erro.value = null
  } catch (e) {
    erro.value = mensagemDeErro(e, 'Não foi possível ler a massa de teste')
  } finally {
    carregando.value = false
  }
}
onMounted(carregar)
defineExpose({ carregar })

const ORDEM_PAPEL: Record<AlunoMassaE2e['papel'], number> = { aprovado: 0, candidato: 1, descartado: 2, avulso: 3 }

interface Linha extends AlunoMassaE2e {
  cenario: CenarioMassaE2e
  primeira: boolean
  linhasDoCenario: number
}

const linhas = computed<Linha[]>(() => {
  const q = busca.value.trim().toLowerCase()
  const r: Linha[] = []
  for (const c of dados.value?.cenarios ?? []) {
    const alunos = c.alunos
      .filter(a => !soAprovados.value || a.papel === 'aprovado')
      .filter(a => !q || String(a.codigoAluno).includes(q) || c.id.includes(q) || c.titulo.toLowerCase().includes(q))
      .sort((a, b) => ORDEM_PAPEL[a.papel] - ORDEM_PAPEL[b.papel] || a.codigoAluno - b.codigoAluno)
    if (!alunos.length) {
      if (!q && !soAprovados.value) r.push({ cenario: c, primeira: true, linhasDoCenario: 1, codigoAluno: 0, papel: 'candidato' })
      continue
    }
    alunos.forEach((a, i) => r.push({ ...a, cenario: c, primeira: i === 0, linhasDoCenario: alunos.length }))
  }
  return r
})

const totais = computed(() => {
  const cenarios = dados.value?.cenarios ?? []
  return {
    comAluno: cenarios.filter(c => c.alunos.some(a => a.papel === 'aprovado')).length,
    cenarios: cenarios.length,
    candidatos: cenarios.reduce((n, c) => n + c.alunos.filter(a => a.papel === 'candidato').length, 0)
  }
})

const PAPEL: Record<AlunoMassaE2e['papel'], { rotulo: string, cor: 'success' | 'neutral' | 'info' | 'error', ajuda: string }> = {
  aprovado: { rotulo: 'Usado no teste', cor: 'success', ajuda: 'Gravação do cenário (gravacoes/<id>.har)' },
  candidato: { rotulo: 'Candidato', cor: 'neutral', ajuda: 'Tentado pela esteira e não aprovado (gravacoes/candidatos)' },
  descartado: { rotulo: 'Descartado', cor: 'error', ajuda: 'Alguém descartou este aluno: a esteira não o sorteia mais para o cenário' },
  avulso: { rotulo: 'Avulso', cor: 'info', ajuda: 'Gravação fora do catálogo' }
}

function copiarCodigo(codigo: number) {
  navigator.clipboard?.writeText(String(codigo))
  toast.add({ title: `Código ${codigo} copiado`, color: 'success', duration: 1500 })
}

function csv(): string {
  const cab = ['cenario', 'titulo', 'status_cenario', 'papel', 'codigo_aluno', 'resultado', 'tela', 'periodo_letivo', 'cod_periodo_letivo', 'curso', 'cod_curso', 'instituicao', 'campus', 'persona', 'no_soft_launch']
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const corpo = linhas.value.filter(l => l.codigoAluno).map(l => [
    l.cenario.id, l.cenario.titulo, l.cenario.status, l.papel, l.codigoAluno, l.resultado, l.rota,
    l.aluno?.periodoLetivo, l.aluno?.codigoPeriodoLetivo, l.aluno?.curso, l.aluno?.codigoCurso,
    l.aluno?.instituicao, l.aluno?.campus, l.aluno?.persona,
    l.aluno?.estaNoSoftLaunch === null || l.aluno?.estaNoSoftLaunch === undefined ? '' : l.aluno.estaNoSoftLaunch ? 'S' : 'N'
  ].map(esc).join(';'))
  return [cab.join(';'), ...corpo].join('\n')
}

function baixarCsv() {
  const blob = new Blob(['﻿' + csv()], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `massa-e2e-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ totais.comAluno }} de {{ totais.cenarios }} cenários com aluno gravado · {{ totais.candidatos }} candidatos tentados.
        Período, curso e soft launch são os que o <strong>HML</strong> devolveu na gravação (não a view do Databricks).
      </p>
      <div class="flex gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="carregando"
          aria-label="Atualizar massa"
          @click="carregar"
        />
        <UButton icon="i-lucide-download" variant="outline" :disabled="!linhas.length" @click="baixarCsv">
          CSV
        </UButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UInput
        v-model="busca"
        icon="i-lucide-search"
        placeholder="Cenário ou código do aluno"
        class="w-full sm:w-64"
      />
      <USwitch v-model="soAprovados" label="Só os alunos usados nos testes" />
    </div>

    <UAlert
      v-if="erro"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="erro"
    />

    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table class="w-full min-w-[960px] text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
          <tr>
            <th class="px-3 py-2">
              Cenário
            </th>
            <th class="px-3 py-2">
              Aluno
            </th>
            <th class="px-3 py-2">
              Resultado / tela
            </th>
            <th class="px-3 py-2">
              Período (HML)
            </th>
            <th class="px-3 py-2">
              Curso
            </th>
            <th class="px-3 py-2">
              Persona
            </th>
            <th class="px-3 py-2">
              Soft launch
            </th>
            <th class="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(l, i) in linhas"
            :key="`${l.cenario.id}-${l.codigoAluno}-${i}`"
            class="align-top"
            :class="l.primeira ? 'border-t border-gray-200 dark:border-gray-800' : ''"
          >
            <td v-if="l.primeira" :rowspan="l.linhasDoCenario" class="px-3 py-2">
              <div class="font-medium">
                {{ l.cenario.titulo }}
              </div>
              <div class="font-mono text-xs text-gray-500">
                {{ l.cenario.id }}
              </div>
              <UBadge
                :color="STATUS_E2E[l.cenario.status].cor"
                variant="subtle"
                size="sm"
                class="mt-1"
                :title="STATUS_E2E[l.cenario.status].ajuda"
              >
                {{ STATUS_E2E[l.cenario.status].rotulo }}
              </UBadge>
            </td>
            <template v-if="l.codigoAluno">
              <td class="px-3 py-2">
                <div class="flex items-center gap-1">
                  <span class="font-mono font-medium">{{ l.codigoAluno }}</span>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-copy"
                    aria-label="Copiar código"
                    @click="copiarCodigo(l.codigoAluno)"
                  />
                </div>
                <UBadge :color="PAPEL[l.papel].cor" variant="outline" size="xs" :title="PAPEL[l.papel].ajuda">
                  {{ PAPEL[l.papel].rotulo }}
                </UBadge>
              </td>
              <td v-if="l.papel === 'descartado'" colspan="5" class="px-3 py-2 text-xs text-gray-500">
                por {{ l.descarte?.por }} em {{ l.gravadoEm ? new Date(`${l.gravadoEm}T12:00:00`).toLocaleDateString('pt-BR') : '' }}
                <span v-if="l.descarte?.motivo"> · {{ l.descarte.motivo }}</span>
              </td>
              <td v-if="l.papel !== 'descartado'" class="px-3 py-2 text-xs">
                <UBadge
                  v-if="l.resultado"
                  :color="RESULTADO_TENTATIVA[l.resultado].cor"
                  variant="outline"
                  size="xs"
                  :title="AJUDA_RESULTADO[l.resultado]"
                >
                  {{ RESULTADO_TENTATIVA[l.resultado].rotulo }}
                </UBadge>
                <div v-if="l.rota !== undefined" class="mt-0.5 font-mono text-gray-500">
                  {{ l.rota || '(raiz)' }}
                </div>
                <div v-if="l.regra" class="mt-0.5 text-gray-600 dark:text-gray-400" :title="`Regra de tela que o dado do aluno aciona: ${l.regra.rota}`">
                  <UIcon name="i-lucide-scale" class="mr-0.5 align-text-bottom" />{{ l.regra.titulo }}
                </div>
                <div v-if="l.gravadoEm" class="text-gray-400">
                  {{ new Date(`${l.gravadoEm}T12:00:00`).toLocaleDateString('pt-BR') }}
                </div>
              </td>
              <td v-if="l.papel !== 'descartado'" class="px-3 py-2 text-xs">
                <template v-if="l.aluno?.periodoLetivo">
                  {{ l.aluno.periodoLetivo }} <span class="font-mono text-gray-500">({{ l.aluno.codigoPeriodoLetivo }})</span>
                </template>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td v-if="l.papel !== 'descartado'" class="px-3 py-2 text-xs">
                <template v-if="l.aluno?.curso">
                  {{ l.aluno.curso }} <span class="font-mono text-gray-500">({{ l.aluno.codigoCurso }})</span>
                  <div class="text-gray-500">
                    {{ [l.aluno.instituicao, l.aluno.campus].filter(Boolean).join(' · ') }}
                  </div>
                </template>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td v-if="l.papel !== 'descartado'" class="px-3 py-2 font-mono text-xs">
                {{ l.aluno?.persona ?? '—' }}
              </td>
              <td v-if="l.papel !== 'descartado'" class="px-3 py-2 text-xs">
                <UBadge
                  v-if="l.aluno && l.aluno.estaNoSoftLaunch !== null"
                  :color="l.aluno.estaNoSoftLaunch ? 'success' : 'warning'"
                  variant="subtle"
                  size="xs"
                >
                  {{ l.aluno.estaNoSoftLaunch ? 'Sim' : 'Não' }}
                </UBadge>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-3 py-2">
                <div class="flex justify-end gap-1">
                  <UButton
                    v-if="l.captura"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-image"
                    aria-label="Ver captura"
                    @click="emit('captura', l.captura, `${l.cenario.id} · aluno ${l.codigoAluno}`)"
                  />
                  <UButton
                    v-if="l.papel === 'aprovado' || l.papel === 'candidato'"
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    title="Descartar: a tela não condiz com o cenário"
                    aria-label="Descartar aluno"
                    :disabled="rodando"
                    @click="emit('descartar', l.cenario.id, l.codigoAluno)"
                  />
                  <UButton
                    v-if="l.papel === 'descartado'"
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-undo-2"
                    title="Permitir de novo: a esteira volta a poder sortear este aluno"
                    :disabled="rodando"
                    @click="emit('permitir', l.cenario.id, l.codigoAluno)"
                  >
                    Permitir
                  </UButton>
                </div>
              </td>
            </template>
            <td v-else colspan="7" class="px-3 py-2 text-xs text-gray-400">
              Nenhum aluno gravado ainda.
            </td>
          </tr>
          <tr v-if="!linhas.length && !carregando">
            <td colspan="8" class="px-3 py-6 text-center text-gray-500">
              Nada com esse filtro.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="dados?.avulsos.length" class="text-xs text-gray-500">
      Gravações avulsas (fora do catálogo):
      <span v-for="a in dados.avulsos" :key="a.arquivo" class="mr-3 font-mono">
        {{ a.codigoAluno }}<span v-if="a.aluno"> ({{ descreverAlunoHml(a.aluno) }})</span>
      </span>
    </div>
  </div>
</template>
