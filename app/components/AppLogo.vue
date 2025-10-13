<script setup lang="ts">
// Importa a imagem do ícone
const iconUrl = '/images/logo.png' // Ajuste o caminho conforme sua estrutura de pastas
</script>

<template>
  <div class="flex items-end gap-1">
    <!-- Ícone PNG -->
    <img 
      :src="iconUrl" 
      alt="Anima Icon" 
      class="h-6 w-6 object-contain"
    />
    
    <!-- Texto "Anima" -->
    <span class="text-xl font-bold tracking-tight leading-none">
      Anima
    </span>
  </div>
</template>