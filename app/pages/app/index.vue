<script setup lang="ts">
import DashPendencias from '~/components/app/DashPendencias.vue'

const title = 'Rematrícula - Pendências'
const description = 'Visão geral das pendências de alunos'

useSeoMeta({
  titleTemplate: '',
  title,
  ogTitle: title,
  description,
  ogDescription: description
})
</script>

<template>
  <DashPendencias />
</template>
