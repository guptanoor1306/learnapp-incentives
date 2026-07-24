import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.ts';

function poolConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required. Add Railway Postgres and reference ${{Postgres.DATABASE_URL}}.');
  }
  return {
    connectionString: url,
    ssl: url.includes('railway.app') || process.env.PGSSL === 'true'
      ? { rejectUnauthorized: false as const }
      : undefined,
    connectionTimeoutMillis: 15000,
  };
}

const pool = new Pool(poolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

export const db = drizzle({ client: pool, schema });
