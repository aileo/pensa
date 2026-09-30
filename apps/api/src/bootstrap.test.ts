import { afterEach, describe, expect, it } from 'vitest';
import { connection } from './db.js';
import { ConfigError, bootstrap, readConfig } from './bootstrap.js';

const keys = ['DATABASE_URL', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB',
  'BOOTSTRAP_EMAIL', 'BOOTSTRAP_PASSWORD', 'BOOTSTRAP_FIRST_NAME', 'BOOTSTRAP_LAST_NAME', 'BOOTSTRAP_BIRTH_DATE',
  'BOOTSTRAP_HOUSEHOLD', 'BOOTSTRAP_FAMILY'];
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const set = (values: Record<string, string | undefined>) => {
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) if (value !== undefined) process.env[key] = value;
};
afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const account = {
  BOOTSTRAP_EMAIL: 'Camille@Example.org', BOOTSTRAP_PASSWORD: 'mot-de-passe-solide',
  BOOTSTRAP_FIRST_NAME: 'Camille', BOOTSTRAP_LAST_NAME: 'Durand', BOOTSTRAP_BIRTH_DATE: '1985-07-24',
};

describe('connexion à la base', () => {
  it('utilise DATABASE_URL quand elle est fournie', () => {
    set({ DATABASE_URL: 'postgres://someone:secret@ailleurs:5433/autre', POSTGRES_USER: 'ignoré' });
    expect(connection()).toEqual({ connectionString: 'postgres://someone:secret@ailleurs:5433/autre' });
  });
  it('se construit sinon à partir des variables postgres, sans encodage à prévoir', () => {
    set({ POSTGRES_USER: 'pensa', POSTGRES_PASSWORD: 'p@ss/w:rd#1', POSTGRES_DB: 'cadeaux', POSTGRES_PORT: '5433' });
    expect(connection()).toEqual({ host: 'db', port: 5433, user: 'pensa', password: 'p@ss/w:rd#1', database: 'cadeaux' });
  });
  it('retombe sur les valeurs du compose quand rien n’est défini', () => {
    set({});
    expect(connection()).toEqual({ host: 'db', port: 5432, user: 'pensa', password: 'pensa', database: 'pensa' });
  });
});

describe('premier compte créé depuis l’environnement', () => {
  it('ne fait rien quand aucun compte n’est configuré', () => {
    set({});
    expect(readConfig()).toBeUndefined();
  });
  it('normalise l’adresse et nomme le foyer d’après le prénom', () => {
    set(account);
    expect(readConfig()).toMatchObject({ email: 'camille@example.org', householdName: 'Foyer de Camille' });
  });
  it('accepte un nom de foyer et une famille explicites', () => {
    set({ ...account, BOOTSTRAP_HOUSEHOLD: 'Foyer Durand', BOOTSTRAP_FAMILY: 'Famille Durand' });
    expect(readConfig()).toMatchObject({ householdName: 'Foyer Durand', familyName: 'Famille Durand' });
  });
  it('refuse une configuration incomplète plutôt que de deviner', () => {
    set({ BOOTSTRAP_EMAIL: account.BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD: account.BOOTSTRAP_PASSWORD });
    expect(() => readConfig()).toThrow(ConfigError);
  });
  it('refuse un mot de passe plus court que celui exigé au formulaire', () => {
    set({ ...account, BOOTSTRAP_PASSWORD: 'trop-court' });
    expect(() => readConfig()).toThrow(/12 caractères/);
  });
  it('refuse une date de naissance qui n’en est pas une', () => {
    set({ ...account, BOOTSTRAP_BIRTH_DATE: '24/07/1985' });
    expect(() => readConfig()).toThrow(/AAAA-MM-JJ/);
  });
  // The database this runs against is seeded, which is exactly the state that must be left
  // alone: bootstrap installs an instance, it never touches one that is already in use.
  it('ne touche pas à une base qui contient déjà des comptes', async () => {
    set(account);
    await expect(bootstrap()).resolves.toBe('skipped');
  });
});
