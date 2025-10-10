<script setup lang="ts">
const route = useRoute()
const user = ref<any>(null)
const loggingOut = ref(false)

/*const items = computed(() => [{
  label: 'Docs',
  to: '/docs',
  active: route.path.startsWith('/docs')
}, {
  label: 'Blog',
  to: '/blog'
}, {
  label: 'Changelog',
  to: '/changelog'
}])*/

onMounted(async () => {
  try {
    const response = await $fetch('/api/auth/me') as any
    if (response && response.user) {
      user.value = response.user
    }
  } catch (error) {
    // Não redirecionar em páginas públicas
    // O middleware já cuida do redirecionamento para rotas protegidas (/app/*)
    console.log('User not authenticated')
  }
})

async function handleLogout() {
  loggingOut.value = true

  try {
    await $fetch('/api/auth/logout', {
      method: 'POST'
    })

    await navigateTo('/login')
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <UHeader>
    <template #left>
      <NuxtLink to="/">
        <AppLogo class="w-auto h-6 shrink-0" />
      </NuxtLink>
      <TemplateMenu />
    </template>

    <template #right>
      <UColorModeButton />
        <div v-if="!user?.loggedIn">
          <UButton
            icon="i-lucide-log-in"
            color="neutral"
            variant="ghost"
            to="/login"
            class="lg:hidden"
          />

          <UButton
            label="Sign in"
            color="neutral"
            variant="outline"
            to="/login"
            class="hidden lg:inline-flex"
          />
        </div>
        <div v-else class="flex items-center gap-2">
          <UPopover>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="loggingOut"
            >
              <UIcon name="i-heroicons-user-circle" class="h-5 w-5" />
              <span class="hidden sm:inline ml-2">{{ user?.email?.split('@')[0] || 'Usuário' }}</span>
              <UIcon name="i-heroicons-chevron-down" class="ml-1 h-4 w-4" />
            </UButton>

            <template #content>
              <div class="p-2 min-w-[200px]">
                <div class="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                  <UIcon name="i-heroicons-user-circle" class="inline h-4 w-4 mr-2" />
                  {{ user?.email || 'Carregando...' }}
                </div>
                <UButton
                  variant="ghost"
                  color="neutral"
                  class="w-full justify-start mt-1"
                  @click="handleLogout"
                  :loading="loggingOut"
                >
                  <UIcon name="i-heroicons-arrow-right-on-rectangle" class="mr-2 h-4 w-4" />
                  Sair
                </UButton>
              </div>
            </template>
          </UPopover>
        </div>
    </template>

    <template #body>
      <!--<UNavigationMenu
        :items="items"
        orientation="vertical"
        class="-mx-2.5"
      />-->

      <USeparator class="my-6" />

      <UButton
        label="Sign in"
        color="neutral"
        variant="subtle"
        to="/login"
        block
        class="mb-3"
      />
    </template>
  </UHeader>
</template>
