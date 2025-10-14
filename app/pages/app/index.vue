<script setup lang="ts">
import DashAlunos from '~/components/app/DashAlunos.vue'

const title = 'Rematrícula - Dashboard'
const description = 'Sistema de rematrícula de alunos'

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
