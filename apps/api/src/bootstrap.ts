import { fileURLToPath } from 'node:url';
import { hash } from 'bcryptjs';
import { pool } from './db.js';
import { createDefaultOccasions } from './family.js';

// Creates the very first account from the environment, so an instance can be installed without
// anyone opening a browser. It runs on every start and does nothing almost every time:
//
//  - no BOOTSTRAP_EMAIL: this is not a bootstrapped instance, carry on;
//  - accounts already exist: this is an installed instance, carry on. Bootstrap is an install,
//    not a repair — recreating an admin on a live database would be a back door, not a
//    convenience.
//
// When it does run and the configuration is wrong, it stops the container rather than starting
// without the account someone is waiting for, or with a weaker one than they asked for.

export class ConfigError extends Error {}

export type BootstrapConfig = {
  email: string; password: string; firstName: string; lastName: string;
  birthDate: string; householdName: string; familyName?: string;
};

const trimmed = (name: string) => process.env[name]?.trim() || undefined;
const required = (name: string) => trimmed(name) ?? (() => {
  throw new ConfigError(`${name} est requise pour créer le premier compte (BOOTSTRAP_EMAIL est définie).`);
})();

// Returns undefined when no bootstrap is configured, and throws when it is configured badly.
// The distinction matters: silence is the normal case, a typo must not be one.
export const readConfig = (): BootstrapConfig | undefined => {
  const email = trimmed('BOOTSTRAP_EMAIL');
  if (!email) return undefined;
  const password = required('BOOTSTRAP_PASSWORD');
  if (password.length < 12) throw new ConfigError('BOOTSTRAP_PASSWORD doit faire au moins 12 caractères.');
  const firstName = required('BOOTSTRAP_FIRST_NAME');
  const lastName = required('BOOTSTRAP_LAST_NAME');
  const birthDate = required('BOOTSTRAP_BIRTH_DATE');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate)))
    throw new ConfigError('BOOTSTRAP_BIRTH_DATE doit être une date au format AAAA-MM-JJ.');
  return {
    email: email.toLowerCase(), password, firstName, lastName, birthDate,
    householdName: trimmed('BOOTSTRAP_HOUSEHOLD') ?? `Foyer de ${firstName}`,
    familyName: trimmed('BOOTSTRAP_FAMILY'),
  };
};

export const bootstrap = async (): Promise<'skipped' | 'created'> => {
  const config = readConfig();
  if (!config) return 'skipped';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // The same lock the open-registration exception takes, so a bootstrap and a first sign-up
    // racing each other cannot both conclude the database is empty.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['pensa:open-registration']);
    if ((await client.query('SELECT 1 FROM users LIMIT 1')).rowCount) {
      await client.query('ROLLBACK');
      console.log('Bootstrap ignoré : des comptes existent déjà.');
      return 'skipped';
    }
    const householdId = (await client.query<{ id: string }>('INSERT INTO households(name) VALUES($1) RETURNING id',
      [config.householdName])).rows[0].id;
    const userId = (await client.query<{ id: string }>(`INSERT INTO users(household_id,first_name,last_name,email,password_hash,birth_date,household_admin)
      VALUES($1,$2,$3,$4,$5,$6,true) RETURNING id`,
    [householdId, config.firstName, config.lastName, config.email, await hash(config.password, 12), config.birthDate])).rows[0].id;
    if (config.familyName) {
      const familyId = (await client.query<{ id: string }>('INSERT INTO families(name) VALUES($1) RETURNING id',
        [config.familyName])).rows[0].id;
      await client.query('INSERT INTO memberships VALUES($1,$2)', [familyId, householdId]);
      await client.query('INSERT INTO family_admins VALUES($1,$2)', [familyId, userId]);
      await createDefaultOccasions(client, familyId);
    }
    await client.query('COMMIT');
    console.log(`Premier compte créé : ${config.email} (foyer « ${config.householdName} »`
      + `${config.familyName ? `, famille « ${config.familyName} »` : ''}).`);
    console.log('Changez ce mot de passe après la première connexion : il est lisible dans la configuration.');
    return 'created';
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// Only when run as a command. Importing the module — from the tests — must not touch anything.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await bootstrap();
  } catch (e) {
    // A configuration mistake has to be loud. Starting anyway would leave someone refreshing a
    // login page for an account that was never going to exist.
    console.error(e instanceof ConfigError ? `Bootstrap impossible : ${e.message}` : e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
