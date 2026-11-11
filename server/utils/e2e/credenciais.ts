import type { H3Event } from 'h3'
import { getSessionFromEvent, salvarSenhaNaSessao } from '../session'
import { decrypt, encrypt } from '../encryption'
import { getOrRefreshToken } from '../azure-token'
import type { CredenciaisE2e } from './esteira'

/**
 * Credenciais de quem chamou a rota, para gerar o token de HML na esteira.
 * A senha só é pedida quando não há outro jeito de ter o token (getOrRefreshToken):
 * token de HML em cache, refresh token guardado ou senha na sessão.
 * A senha informada no modal é conferida (gera o token) e guardada na sessão, para não pedir de novo.
 * Retorna null quando falta a senha (a tela pede e reenvia).
 */
export async function credenciaisDaSessao(event: H3Event, senhaInformada?: string): Promise<CredenciaisE2e | null> {
  const session = await getSessionFromEvent(event)
  if (!session) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }
  const config = useRuntimeConfig()

  if (senhaInformada) {
    const token = await getOrRefreshToken(session.email, 'hml', senhaInformada)
    if (!token.success) {
      // 400, não 401: senha errada não é sessão expirada (a tela mostra a mensagem e pode pedir de novo)
      throw createError({ statusCode: 400, message: `Não foi possível gerar o token de HML com essa senha: ${token.error ?? 'erro desconhecido'}` })
    }
    salvarSenhaNaSessao(event, encrypt(senhaInformada, config.encryptionKey))
    return { email: session.email, password: senhaInformada }
  }

  if (session.encrypted_password) {
    return { email: session.email, password: decrypt(session.encrypted_password, config.encryptionKey) }
  }

  // Sem senha na sessão (ex.: servidor reiniciou): segue se ainda há token válido ou renovável.
  const token = await getOrRefreshToken(session.email, 'hml')
  return token.success ? { email: session.email } : null
}
