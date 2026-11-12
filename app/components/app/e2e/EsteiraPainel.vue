<script setup lang="ts">
import type { EstadoEsteiraE2e } from '~~/types'

/** Andamento da esteira (geração ou gravação de aluno informado) e resultado da última execução. */
const props = defineProps<{ esteira: EstadoEsteiraE2e }>()
const emit = defineEmits<{ captura: [caminho: string, titulo: string] }>()

const verLog = ref(false)

const hora = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('pt-BR') : ''

const titulo = computed(() => {
  const e = props.esteira
  if (e.rodando) return `Esteira rodando${e.cenarioAtual ? `: ${e.cenarioAtual}` : ''}`
  return `Última execução terminou às ${hora(e.terminadoEm)}`
})

const logInvertido = computed(() => [...props.esteira.log].reverse())
</script>

<template>
  <UCard :ui="{ body: 'space-y-3' }">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <UIcon
          :name="esteira.rodando ? 'i-lucide-loader-circle' : 'i-lucide-circle-check'"
          class="size-5"
          :class="esteira.rodando ? 'animate-spin text-primary' : 'text-success'"
        />
        <span class="font-medium">{{ titulo }}</span>
      </div>
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ esteira.iniciadoPor }} · início {{ hora(esteira.iniciadoEm) }}
      </span>
    </div>

    <ul v-if="esteira.resultados.length" class="divide-y divide-gray-100 text-sm dark:divide-gray-800">
      <li v-for="r in esteira.resultados" :key="r.id" class="py-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono">{{ r.id }}</span>
          <UBadge :color="STATUS_E2E[r.status].cor" variant="subtle" size="sm">
            {{ STATUS_E2E[r.status].rotulo }}
          </UBadge>
          <span v-if="r.alunosNoPerfil !== undefined" class="text-xs text-gray-500">
            {{ r.alunosNoPerfil.toLocaleString('pt-BR') }} aluno(s) no perfil
          </span>
          <span v-if="!r.catalogoAtualizado && !r.erro" class="text-xs text-gray-500">catálogo mantido</span>
        </div>
        <p v-if="r.erro" class="mt-1 text-xs text-error">
          {{ r.erro }}
        </p>
        <ul v-if="r.tentativas.length" class="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          <li v-for="t in r.tentativas" :key="t.codigoAluno" class="flex flex-wrap items-center gap-2">
            <span class="font-mono">{{ t.codigoAluno }}</span>
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
              @click="emit('captura', t.png, `${r.id} · aluno ${t.codigoAluno}`)"
            >
              Captura
            </UButton>
          </li>
        </ul>
      </li>
    </ul>

    <div>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="verLog ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        @click="() => { verLog = !verLog }"
      >
        Log ({{ esteira.log.length }})
      </UButton>
      <pre
        v-if="verLog"
        class="mt-2 max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs leading-relaxed dark:bg-gray-800/60"
      >{{ logInvertido.join('\n') }}</pre>
    </div>
  </UCard>
</template>
