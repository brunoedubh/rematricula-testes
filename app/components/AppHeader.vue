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
    console.error('Failed to load user data:', error)
    await navigateTo('/login')
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
        <div v-else>
          <UBadge color="primary" variant="subtle" class="hidden sm:flex">
            <UIcon name="i-heroicons-user-circle" class="mr-1 h-4 w-4" />
            {{ user?.email || 'Carregando...' }}
          </UBadge>

          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="handleLogout"
            :loading="loggingOut"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="mr-2 h-4 w-4" />
            <span class="hidden sm:inline">Sair</span>
          </UButton>
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
