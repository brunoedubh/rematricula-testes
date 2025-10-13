<script setup lang="ts">
useSeoMeta({
  titleTemplate: '',
  title: 'Rematrícula - Portal de Gestão',
  ogTitle: 'Rematrícula - Portal de Gestão',
  description: 'Sistema de gestão de tokens e acessos para rematrícula',
  ogDescription: 'Sistema de gestão de tokens e acessos para rematrícula'
})

// Redirecionar para login se não estiver autenticado, ou para /app se já estiver
onMounted(async () => {
  try {
    const response = await $fetch('/api/auth/me') as any
    if (response && response.user && response.user.email) {
      await navigateTo('/app')
    }
  } catch {
    // Usuário não está logado, mostrar página inicial
  }
})
</script>

<template>
  <div>
    <UPageHero
      title="Rematrícula"
      description="Sistema de gestão de tokens e acessos para rematrícula de alunos"
      :links="[
        {
          label: 'Fazer Login',
          to: '/login',
          size: 'lg',
          color: 'primary',
          icon: 'i-lucide-lock'
        }
      ]"
    >
      <template #top>
        <HeroBackground />
      </template>
    </UPageHero>
  </div>
</template>
