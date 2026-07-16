<script setup lang="ts">
//import DashPendencias from '~/components/app/DashPendencias.vue'
import DashAlunos from '~/components/app/DashAlunos.vue'

const title = 'Rematrícula - Alunos'
const description = 'Visão geral de alunos'

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
