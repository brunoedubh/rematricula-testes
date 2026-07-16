<script setup lang="ts">
</script>

<template>
  <USeparator
    icon="i-simple-icons-nuxtdotjs"
    class="h-px"
  />

  <UFooter :ui="{ top: 'border-b border-default' }">
    <template #left>
      <p class="text-muted text-sm">
        Feito por Renovar • © {{ new Date().getFullYear() }}
      </p>
    </template>
  </UFooter>
</template>
