export default defineNuxtRouteMiddleware((to) => {
  // Rotas que não precisam de autenticação
  const publicRoutes = ['/', '/login']

  // Se a rota é pública, permitir acesso
  if (publicRoutes.includes(to.path)) {
    return
  }

  // Se a rota começa com /app, precisa de autenticação
  if (to.path.startsWith('/app')) {
    // Verificar autenticação apenas no lado do cliente após hidratação
    if (process.client) {
      return checkClientAuth()
    }
  }
})

async function checkClientAuth() {
  try {
    const response = await $fetch('/api/auth/me') as any

    if (!response || !response.user) {
      return navigateTo('/login')
    }
  } catch (error) {
    // Se houver erro na verificação, redirecionar para login
    console.warn('Auth check failed:', error)
    return navigateTo('/login')
  }
}