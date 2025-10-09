<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { LoginRequest } from '../../types'
import { fi } from 'zod/locales'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Login',
  description: 'Login to your account to continue'
})

const toast = useToast()

const fields = [{
  name: 'email',
  type: 'text' as const,
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password' as const,
  placeholder: 'Enter your password'
}, {
  name: 'remember',
  label: 'Remember me',
  type: 'checkbox' as const
}]

const schema = z.object({
  email: z.string().min(4, 'Usuário inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres')
})

type Schema = z.output<typeof schema>

const loading = ref(false)
const error = ref('')

async function handleLogin(payload: FormSubmitEvent<Schema>) {
  console.log(payload)
  if (!payload.data.email || !payload.data.password) {
    console.log(payload.email)
    error.value = 'Email e senha são obrigatórios'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch<{ success: boolean, error?: string }>('/api/auth/login', {
      method: 'POST',
      body: payload.data
    })

    if (response.success) {
      // Redirecionar para a página principal
      await navigateTo('/app')
    } else {
      error.value = response.error || 'Erro ao fazer login'
      toast.add({ title: 'Erro', description: error.value })
    }
  } catch (err: any) {
    console.error('Login error:', err)
    error.value = err.data?.error || 'Erro de conexão. Tente novamente.'
    toast.add({ title: 'Erro', description: error.value })
  } finally {    
    loading.value = false
  }
}

// Redirecionar se já estiver logado
onMounted(async () => {
  try {
    const response = await $fetch('/api/auth/me') as any
    if (response && response.user && response.user.email) {
      await navigateTo('/app')
    }
  } catch {
    // Usuário não está logado, continuar na página de login
  }
})
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    title="Welcome back"
    icon="i-lucide-lock"
    @submit.prevent="handleLogin"
  >
    <template #description>
      Don't have an account? <ULink
        to="/signup"
        class="text-primary font-medium"
      >Sign up</ULink>.
    </template>

    <template #password-hint>
      <ULink
        to="/"
        class="text-primary font-medium"
        tabindex="-1"
      >Forgot password?</ULink>
    </template>

    <template #footer>
      By signing in, you agree to our <ULink
        to="/"
        class="text-primary font-medium"
      >Terms of Service</ULink>.
    </template>
  </UAuthForm>
</template>
