import type pg from 'pg';

// What a new family starts with. Shared between the API and the bootstrap script so an
// instance installed from environment variables looks exactly like one created in the
// interface — two lists that drift apart would only be noticed by the person who has both.
export const defaultOccasions: [string, string, number | null, number | null][] = [
  ['Anniversaire', 'birthday', null, null],
  ['Fête', 'name_day', null, null],
  ['Noël', 'fixed', 12, 25],
];

export const createDefaultOccasions = async (client: pg.PoolClient, familyId: string) => {
  for (const [name, kind, month, day] of defaultOccasions)
    await client.query('INSERT INTO occasions(family_id,name,kind,month,day) VALUES($1,$2,$3,$4,$5)',
      [familyId, name, kind, month, day]);
};
