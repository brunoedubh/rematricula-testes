<script setup lang="ts">
import DashAlunos from '~/components/app/DashAlunos.vue'

const title = 'Rematrícula - Geração de Tokens'
const description = 'Busca de alunos e geração de tokens'

useSeoMeta({
  titleTemplate: '',
  title,
  ogTitle: title,
  description,
  ogDescription: description
})
</script>

<template>
  <DashAlunos />
</template>
