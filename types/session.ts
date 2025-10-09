export interface UserCredentials {
  email: string
  password: string
}

export interface SessionUser {
  email: string
  encrypted_password: string
  created_at: number
  expires_at: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  user?: {
    email: string
  }
  error?: string
}

export interface SessionData {
  user: SessionUser
  isValid: boolean
}