import type { Environment } from '~/types'

interface TokenGenerationResult {
  url: string
  token_status: 'cached' | 'new' | 'renewed'
  expires_in_minutes: number
}

export const useTokens = () => {
  const generating = useState('token-generating', () => false)
  const error = useState<string | null>('token-error', () => null)

  /**
   * Gerar URL com token para um aluno em um ambiente específico
   * Esta função será implementada na Fase 4
   */
  const generateTokenUrl = async (
    codAluno: string,
    environment: Environment
  ): Promise<TokenGenerationResult | null> => {
    generating.value = true
    error.value = null

    try {
      // TODO: Implementar na Fase 4 - Sistema de Tokens
      // const response = await $fetch<TokenGenerationResult>('/api/tokens/generate-url', {
      //   method: 'POST',
      //   body: {
      //     cod_aluno: codAluno,
      //     environment
      //   }
      // })
      // return response

      throw new Error('Sistema de tokens ainda não implementado (Fase 4)')
    } catch (err: any) {
      console.error('Token generation error:', err)
      error.value = err.data?.error || err.message || 'Erro ao gerar token'
      return null
    } finally {
      generating.value = false
    }
  }

  /**
   * Abrir URL em nova aba com confirmação para produção
   */
  const openEnvironmentUrl = async (
    url: string,
    environment: Environment,
    studentName: string
  ): Promise<void> => {
    // Confirmação especial para produção
    if (environment === 'prod') {
      const confirmed = window.confirm(
        `  ATENÇÃO - AMBIENTE DE PRODUÇÃO\n\n` +
        `Você está prestes a acessar o ambiente de PRODUÇÃO.\n` +
        `NÃO altere ou execute ações neste ambiente!\n\n` +
        `Aluno: ${studentName}\n` +
        `Ambiente: PRODUÇÃO\n\n` +
        `Tem certeza que deseja continuar?`
      )

      if (!confirmed) {
        return
      }
    }

    // Abrir URL em nova aba
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  /**
   * Limpar estado de erros
   */
  const clearError = () => {
    error.value = null
  }

  return {
    generating: readonly(generating),
    error: readonly(error),
    generateTokenUrl,
    openEnvironmentUrl,
    clearError
  }
}
