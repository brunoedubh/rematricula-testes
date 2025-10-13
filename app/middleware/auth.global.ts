// Cache da última verificação de auth para evitar múltiplas chamadas
let lastAuthCheck: { timestamp: number, isValid: boolean } | null = null
const AUTH_CACHE_DURATION = 5000 // 5 segundos

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) return // Não executar no servidor

  console.log('Global auth middleware triggered for route:', to.fullPath)

  // Apenas proteger rotas que começam com /app
  // Todas as outras rotas são públicas
  if (!to.path.startsWith('/app')) {
    console.log('Public route, skipping auth check')
    return
  }

  // Se estamos vindo do login para /app, não verificar novamente imediatamente
  if (from.path === '/login' && to.path.startsWith('/app')) {
    console.log('Just logged in, skipping auth check')
    return
  }

  // Verificar cache recente
  const now = Date.now()
  if (lastAuthCheck && (now - lastAuthCheck.timestamp) < AUTH_CACHE_DURATION) {
    if (lastAuthCheck.isValid) {
      console.log('Using cached auth result (valid)')
      return
    } else {
      console.log('Using cached auth result (invalid), redirecting to login')
      return navigateTo('/login')
    }
  }

  console.log('Running auth check')
  try {
    const response = await $fetch('/api/auth/me') as any
    console.log('Auth response:', response)

    if (!response || !response.user || !response.success) {
      console.log('Auth failed, redirecting to login')
      lastAuthCheck = { timestamp: now, isValid: false }
      return navigateTo('/login')
    }

    console.log('Auth successful')
    lastAuthCheck = { timestamp: now, isValid: true }
  } catch (error) {
    console.error('Auth check error:', error)
    lastAuthCheck = { timestamp: now, isValid: false }
    // Se houver erro na verificação (401, etc), redirecionar para login
    return navigateTo('/login')
  }
})