export default defineNuxtRouteMiddleware(async (to) => {
  console.log('Global auth middleware triggered for route:', to.fullPath)

  // Apenas proteger rotas que começam com /app
  // Todas as outras rotas são públicas
  if (!to.path.startsWith('/app')) {
    console.log('Public route, skipping auth check')
    return
  }

  console.log('Running auth check on client side')
  try {
    const response = await $fetch('/api/auth/me') as any
    console.log('Auth response:', response)

    if (!response || !response.user || !response.success) {
      console.log('Auth failed, redirecting to login')
      return navigateTo('/login')
    }

    console.log('Auth successful')
  } catch (error) {
    console.error('Auth check error:', error)
    // Se houver erro na verificação (401, etc), redirecionar para login
    return navigateTo('/login')
  }
})