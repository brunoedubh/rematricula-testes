<script setup lang="ts">

const toast = useToast()

const email = ref('')
const loading = ref(false)

</script>

<template>
  <USeparator
    icon="i-simple-icons-nuxtdotjs"
    class="h-px"
  />

  <UFooter :ui="{ top: 'border-b border-default' }">

    <template #left>
      <p class="text-muted text-sm">
        Built with Nuxt UI • © {{ new Date().getFullYear() }}
      </p>
    </template>

  </UFooter>
</template>
