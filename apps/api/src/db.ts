import pg from 'pg';

// A connection string is the simplest thing to pass, and stays the way to point at a managed
// database. But building one from a generated password is a trap: an `@`, `/`, `:` or `#` in it
// has to be percent-encoded, and forgetting surfaces as an authentication error naming the
// wrong host. So when DATABASE_URL is absent we hand the fields to pg separately and the
// question never comes up. It also lets the Compose file carry one set of credentials instead
// of two that have to be kept in step.
export const connection = (): pg.PoolConfig => process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
    host: process.env.POSTGRES_HOST || 'db',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'pensa',
    password: process.env.POSTGRES_PASSWORD || 'pensa',
    database: process.env.POSTGRES_DB || 'pensa',
  };

export const pool = new pg.Pool(connection());
export const query = async <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) =>
  (await pool.query<T>(sql, params)).rows;
