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
   * Gerar URL com token para um aluno em um ambiente espec�fico
   * Esta fun��o ser� implementada na Fase 4
   */
  const generateTokenUrl = async (
    _codAluno: string,
    _environment: Environment
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

      throw new Error('Sistema de tokens ainda n�o implementado (Fase 4)')
    } catch (err) {
      console.error('Token generation error:', err)
      const fetchErr = err as { data?: { error?: string }; message?: string }
      error.value = fetchErr.data?.error || fetchErr.message || 'Erro ao gerar token'
      return null
    } finally {
      generating.value = false
    }
  }

  /**
   * Abrir URL em nova aba com confirma��o para produ��o
   */
  const openEnvironmentUrl = async (
    url: string,
    environment: Environment,
    studentName: string
  ): Promise<void> => {
    // Confirma��o especial para produ��o
    if (environment === 'prod') {
      const confirmed = window.confirm(
        `� ATEN��O - AMBIENTE DE PRODU��O\n\n` +
        `Voc� est� prestes a acessar o ambiente de PRODU��O.\n` +
        `N�O altere ou execute a��es neste ambiente!\n\n` +
        `Aluno: ${studentName}\n` +
        `Ambiente: PRODU��O\n\n` +
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
