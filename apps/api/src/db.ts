import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const query = async <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) =>
  (await pool.query<T>(sql, params)).rows;
