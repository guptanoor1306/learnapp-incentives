export function getPoolConfig() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required. Add Railway Postgres and reference ${{Postgres.DATABASE_URL}}.');
  }

  const needsSsl =
    url.includes('railway.app') ||
    url.includes('rlwy.net') ||
    process.env.PGSSL === 'true';

  return {
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false as const } : undefined,
    connectionTimeoutMillis: 15000,
  };
}
