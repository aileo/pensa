import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

// The migrations travel with the compiled code: ../drizzle resolves to apps/api/drizzle in
// development and to /app/drizzle in the image, so the same command works in both.
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

try {
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('Migrations appliquées.');
} finally {
  await pool.end();
}
