<script setup lang="ts">
const user = ref<{ loggedIn?: boolean } | null>(null)
const isCollapsed = ref(true)

onMounted(async () => {
  try {
    const response = await $fetch('/api/auth/me') as { user?: { loggedIn?: boolean } }
    if (response && response.user) {
      user.value = response.user
    }
  } catch {
    console.log('User not authenticated')
  }
})

const navItems = ref([
  [
    /*{
      label: 'Pendências',
      to: '/app',
      icon: 'i-lucide-alert-circle'
    },*/
    {
      label: 'Alunos e Tokens',
      to: '/app/alunos',
      icon: 'i-lucide-users'
    }
  ]
])
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
    <!-- Sidebar / Painel Lateral -->
    <aside 
      v-if="user?.loggedIn" 
      class="border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-full shrink-0 transition-all duration-300"
      :class="[isCollapsed ? 'w-[72px]' : 'w-64']"
    >
      <div class="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 transition-all" :class="[isCollapsed ? 'justify-center' : 'justify-between']">
        <NuxtLink v-if="!isCollapsed" to="/" class="flex items-center gap-2 overflow-hidden">
          <AppLogo class="w-auto h-6 shrink-0" />
        </NuxtLink>

        <!-- Botão de Expandir / Recolher fica dentro da barra -->
        <UButton
          color="secondary"
          variant="ghost"
          :icon="isCollapsed ? 'i-lucide-menu' : 'i-lucide-chevron-left'"
          class="shrink-0"
          @click="isCollapsed = !isCollapsed"
        />
      </div>
      
      <div class="flex-1 overflow-y-auto py-4" :class="[isCollapsed ? 'px-2' : 'px-3']">
        <!-- Navegação global lado esquerdo -->
        <UNavigationMenu
          :items="navItems"
          orientation="vertical"
          :class="[isCollapsed ? '[&_span.truncate]:hidden [&>ul>li>a]:justify-center' : '']"
        />
      </div>
    </aside>

    <!-- Conteúdo Principal -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- O Cabeçalho (agora mais enxuto) ocupará o topo do conteúdo -->
      <AppHeader class="h-16 shrink-0 border-b border-gray-200 dark:border-gray-800" />

      <!-- Area de Scroll do Conteúdo (Páginas) -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>

      <!-- <AppFooter /> se necessário -->
    </div>
  </div>
</template>
