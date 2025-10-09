import type { LoginRequest, LoginResponse } from '~/types'

interface User {
  email: string
  loggedIn: boolean
  created_at?: number
  expires_at?: number
}

export const useAuth = () => {
  const user = useState<User | null>('auth-user', () => null)
  const loading = useState('auth-loading', () => false)
  const error = useState<string | null>('auth-error', () => null)

  /**
   * Fazer login com credenciais Microsoft
   */
  const login = async (credentials: LoginRequest): Promise<boolean> => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: credentials
      })

      if (response.success && response.user) {
        user.value = {
          email: response.user.email,
          loggedIn: true
        }
        return true
      } else {
        error.value = response.error || 'Erro ao fazer login'
        return false
      }
    } catch (err: any) {
      console.error('Login error:', err)
      error.value = err.data?.error || 'Erro de conexão. Tente novamente.'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Fazer logout e limpar sessão
   */
  const logout = async (): Promise<void> => {
    loading.value = true

    try {
      await $fetch('/api/auth/logout', {
        method: 'POST'
      })

      user.value = null
      await navigateTo('/login')
    } catch (err) {
      console.error('Logout error:', err)
      // Mesmo com erro, limpar estado local
      user.value = null
      await navigateTo('/login')
    } finally {
      loading.value = false
    }
  }

  /**
   * Verificar se o usuário está autenticado
   */
  const checkAuth = async (): Promise<boolean> => {
    if (user.value?.loggedIn) {
      return true
    }

    try {
      const response = await $fetch('/api/auth/me') as any

      if (response && response.user && response.user.email) {
        user.value = {
          email: response.user.email,
          loggedIn: true,
          created_at: response.user.created_at,
          expires_at: response.user.expires_at
        }
        return true
      }

      return false
    } catch {
      user.value = null
      return false
    }
  }

  /**
   * Verificar se a sessão ainda é válida
   */
  const isSessionValid = computed(() => {
    if (!user.value?.expires_at) return false
    return Date.now() < user.value.expires_at
  })

  /**
   * Tempo restante da sessão em minutos
   */
  const sessionTimeRemaining = computed(() => {
    if (!user.value?.expires_at) return 0
    const remaining = user.value.expires_at - Date.now()
    return Math.max(0, Math.floor(remaining / 60000)) // em minutos
  })

  return {
    user: readonly(user),
    loading: readonly(loading),
    error: readonly(error),
    isSessionValid,
    sessionTimeRemaining,
    login,
    logout,
    checkAuth
  }
}
