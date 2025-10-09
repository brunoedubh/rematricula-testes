import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

export function encrypt(text: string, key: string): string {
  if (!text || !key) {
    throw new Error('Text and key are required for encryption')
  }

  if (key.length !== 64) {
    throw new Error('Encryption key must be 64 characters (32 bytes in hex)')
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(encryptedText: string, key: string): string {
  if (!encryptedText || !key) {
    throw new Error('Encrypted text and key are required for decryption')
  }

  if (key.length !== 64) {
    throw new Error('Encryption key must be 64 characters (32 bytes in hex)')
  }

  const textParts = encryptedText.split(':')
  if (textParts.length !== 2) {
    throw new Error('Invalid encrypted text format')
  }

  const ivHex = textParts[0]
  const encryptedData = textParts[1]

  if (!ivHex || !encryptedData) {
    throw new Error('Invalid encrypted text format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashPassword(password: string, salt?: string): { hash: string, salt: string } {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex')
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex')

  return {
    hash,
    salt: actualSalt
  }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return hash === verifyHash
}