import 'server-only'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
const globalDb = globalThis as unknown as { dogePool?: Pool }
const pool = globalDb.dogePool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000 })
if (process.env.NODE_ENV !== 'production') globalDb.dogePool = pool
export const db = drizzle(pool, { schema })
