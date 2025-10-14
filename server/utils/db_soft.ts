import { Pool } from 'pg'

let pool: Pool | null = null

export const getDb = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_SOFT_HOST,
      port: parseInt(process.env.DB_SOFT_PORT || '5432'),
      database: process.env.DB_SOFT_NAME,
      user: process.env.DB_SOFT_USER,
      password: process.env.DB_SOFT_PASSWORD,
      ssl: process.env.DB_SOFT_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20, // número máximo de conexões no pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    })
  }
  return pool
}