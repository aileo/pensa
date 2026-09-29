import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { app } from './app.js';
import { pool } from './db.js';

let server: Server;
let base: string;
const cookies: Record<string, string> = {};
const call = async (as: string, path: string, method = 'GET', body?: unknown) => {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'content-type': 'application/json', cookie: cookies[as] ?? '', origin: 'http://localhost:5173' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() as Record<string, any>, cookie: response.headers.get('set-cookie') };
};
beforeAll(async () => {
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Port manquant');
  base = `http://127.0.0.1:${address.port}`;
  for (const name of ['alice', 'bob', 'charlie', 'david', 'eloise']) {
    const login = await call('', '/auth/login', 'POST', { email: `${name}@example.test`, password: 'GiftitDemo2026!' });
    if (login.status !== 200) throw new Error('Exécuter le seed avant les tests');
    cookies[name] = login.cookie!.split(';')[0];
  }
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
});
describe('permissions métier sur l’API', () => {
  it('renvoie 400 pour un JSON malformé', async () => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: '{broken',
    });
    expect(response.status).toBe(400);
  });
  it('inscrit, authentifie et protège les foyers invités', async () => {
    const email = `new-${Date.now()}@example.test`;
    const registered = await call('', '/auth/register', 'POST', {
      firstName: 'New', lastName: 'User', email, password: 'LongSecret2026!', birthDate: '2000-01-02',
    });
    expect(registered.status).toBe(201);
    cookies.new = registered.cookie!.split(';')[0];
    expect((await call('new', '/auth/me')).data.email).toBe(email);
    expect((await call('new', '/wishes')).status).toBe(200);
    expect((await call('new', '/users')).data).toHaveLength(0);
    expect((await call('new', '/families', 'POST', { name: 'Nouvelle famille' })).status).toBe(201);
    expect((await call('new', '/users')).data).toHaveLength(1);
    expect((await call('new', '/profile', 'PATCH', { firstName: 'New', lastName: 'User', nameDay: '99-99' })).status).toBe(400);
    expect((await call('new', '/profile', 'PATCH', { firstName: 'New', lastName: 'User', nameDay: '11-12' })).status).toBe(200);
    expect((await call('new', '/occasions')).data.some((o: {kind:string;nextDate:string}) =>
      o.kind === 'name_day' && o.nextDate.endsWith('11-12'))).toBe(true);
  });
  it('isole les familles, les réservations du bénéficiaire et les demandes', async () => {
    const bob = await call('bob', '/auth/me');
    const bobId = bob.data.id;
    const aliceWishes = await call('alice', `/users/${bobId}/wishes`);
    const bobWishes = await call('bob', `/users/${bobId}/wishes`);
    const eloiseWishes = await call('eloise', `/users/${bobId}/wishes`);
    expect(aliceWishes.status).toBe(200);
    expect(eloiseWishes.status).toBe(403);
    const reserved = aliceWishes.data.find((w: {reservation?: object}) => w.reservation);
    expect(reserved.reservation.creator.firstName).toBe('Alice');
    const own = bobWishes.data.find((w: {id:string}) => w.id === reserved.id);
    expect(own).not.toHaveProperty('reservation');
    const direct = await call('bob', `/reservations/${reserved.reservation.id}`);
    expect(direct.status).toBe(404);
    expect(await call('bob', `/reservations/${reserved.reservation.id}/requests`)).toMatchObject({ status: 404 });
    expect(await call('charlie', `/reservations/${reserved.reservation.id}/requests`)).toMatchObject({ status: 403 });
  });
  it('ne propage jamais les droits administrateur entre familles', async () => {
    const families = (await call('alice', '/families')).data;
    const familyA = families.find((f: {name:string}) => f.name === 'Famille A');
    const familyB = families.find((f: {name:string}) => f.name === 'Famille B');
    expect(familyA.admin).toBe(true);
    expect(familyB.admin).toBe(false);
    expect(familyA.members.map((p: {firstName:string}) => p.firstName)).toContain('Charlie');
    expect(familyA.members.map((p: {firstName:string}) => p.firstName)).not.toContain('David');
    expect(familyB.members.map((p: {firstName:string}) => p.firstName)).toContain('David');
    expect(familyB.members.map((p: {firstName:string}) => p.firstName)).not.toContain('Charlie');
    expect((await call('alice', `/families/${familyB.id}`, 'PATCH', { name: 'Intrusion' })).status).toBe(403);
    expect((await call('alice', `/families/${familyA.id}`, 'PATCH', { name: 'Famille A' })).status).toBe(200);
  });
  it('utilise une invitation de foyer une seule fois', async () => {
    const householdId = (await call('alice', '/auth/me')).data.householdId;
    expect((await call('charlie', `/households/${householdId}/invitations`, 'POST', {})).status).toBe(403);
    const invite = await call('alice', `/households/${householdId}/invitations`, 'POST', {});
    expect(invite.status).toBe(201);
    const register = (email: string) => call('', '/auth/register', 'POST', {
      firstName: 'Invité', lastName: 'Test', email, password: 'Invitation2026!', birthDate: '1999-02-01',
      invitation: invite.data.code,
    });
    const joined = await register(`invite-${Date.now()}@example.test`);
    expect(joined.status).toBe(201);
    expect(joined.data.householdId).toBe(householdId);
    expect((await register(`replay-${Date.now()}@example.test`)).status).toBe(403);
  });
  it('refuse les modifications principales et les souhaits incomplets', async () => {
    expect((await call('bob', '/wishes', 'POST', { title: 'Sans image', url: 'https://example.com' })).status).toBe(400);
    expect((await call('bob', '/wishes/preview', 'POST', { url: 'http://127.0.0.1/' })).status).toBe(400);
    expect((await call('bob', '/wishes/preview', 'POST', { url: 'not-an-url' })).status).toBe(400);
    const wishes = await call('bob', '/wishes');
    const wish = wishes.data[0];
    expect((await call('bob', `/wishes/${wish.id}`, 'PATCH', { title: 'Changé', tags: ['test'] })).status).toBe(400);
    expect((await call('bob', `/wishes/${wish.id}`, 'PATCH', { tags: ['test'] })).status).toBe(200);
  });
  it('empêche une double réservation concurrente et conserve la confidentialité après suppression', async () => {
    const created = await call('bob', '/wishes', 'POST', {
      title: 'Test concurrent', url: 'https://example.com', image: 'https://example.com/image.png', tags: [],
    });
    expect(created.status).toBe(201);
    const wishId = created.data.id;
    const occasions = await call('alice', `/occasions?recipientId=${(await call('bob', '/auth/me')).data.id}`);
    const choices = occasions.data.filter((o: {nextDate:string|null}) => o.nextDate).slice(0, 2)
      .map((o: {id:string;nextDate:string}) => ({ id: o.id, year: Number(o.nextDate.slice(0, 4)) }));
    expect(choices.length).toBe(2);
    const [one, two] = await Promise.all([
      call('alice', '/reservations', 'POST', { wishId, occasionIds: choices, participantIds: [], openToContributions: true }),
      call('charlie', '/reservations', 'POST', { wishId, occasionIds: choices, participantIds: [] }),
    ]);
    expect([one.status, two.status].sort()).toEqual([201, 409]);
    const winner = one.status === 201 ? 'alice' : 'charlie';
    const loser = winner === 'alice' ? 'charlie' : 'alice';
    const reservation = one.status === 201 ? one.data : two.data;
    expect(reservation.occasions).toHaveLength(2);
    expect((await call('bob', `/users/${(await call('bob', '/auth/me')).data.id}/wishes`)).data
      .find((w: {id:string}) => w.id === wishId)).not.toHaveProperty('reservation');
    expect((await call('bob', `/reservations/${reservation.id}`)).status).toBe(404);
    expect((await call(loser, `/reservations/${reservation.id}/requests`, 'POST')).status).toBe(winner === 'alice' ? 201 : 409);
    expect((await call('bob', `/wishes/${wishId}`, 'DELETE')).status).toBe(200);
    expect((await call(winner, '/reservations')).data.find((r: {id:string}) => r.id === reservation.id).wishDeleted).toBe(true);
    expect((await call(loser, '/reservations', 'POST', { wishId, occasionIds: choices })).status).toBe(404);
    expect((await call(winner, `/reservations/${reservation.id}`, 'DELETE')).status).toBe(200);
    expect((await call(loser, `/reservations/${reservation.id}/requests`, 'POST')).status).toBe(409);
  });
  it('rend le statut offert irréversible et protège l’historique', async () => {
    const history = await call('alice', '/history');
    expect(history.data.length).toBeGreaterThan(0);
    expect((await call('eloise', '/history')).data).toHaveLength(0);
    const bobReservations = await call('bob', '/reservations');
    const gifted = bobReservations.data.find((r: {status:string}) => r.status === 'gifted');
    expect(gifted).toBeTruthy();
    expect((await call('bob', `/reservations/${gifted.id}`, 'PATCH', { status: 'wrapped' })).status).toBe(409);
  });
  it('gère demandes, occasions et transitions jusqu’au snapshot offert', async () => {
    const wish = await call('bob', '/wishes', 'POST', {
      title: 'Cadeau final', url: 'https://example.com', image: 'https://example.com/image.png', tags: ['test'],
    });
    const bobId = (await call('bob', '/auth/me')).data.id;
    const occasions = (await call('alice', `/occasions?recipientId=${bobId}`)).data
      .filter((o: {nextDate:string|null}) => o.nextDate).slice(0, 2)
      .map((o: {id:string;nextDate:string}) => ({ id: o.id, year: Number(o.nextDate.slice(0, 4)) }));
    const created = await call('alice', '/reservations', 'POST', {
      wishId: wish.data.id, occasionIds: occasions, openToContributions: true,
    });
    expect(created.status).toBe(201);
    const id = created.data.id;
    const asked = await call('charlie', `/reservations/${id}/requests`, 'POST');
    expect(asked.status).toBe(201);
    const declined = await call('david', `/reservations/${id}/requests`, 'POST');
    expect(declined.status).toBe(201);
    expect((await call('bob', `/reservations/${id}/requests`)).status).toBe(404);
    expect((await call('alice', `/reservations/${id}/requests/${asked.data.id}`, 'PATCH', { status: 'accepted' })).status).toBe(200);
    expect((await call('alice', `/reservations/${id}/requests/${declined.data.id}`, 'PATCH', { status: 'refused' })).status).toBe(200);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', {
      occasionIds: [occasions[0], { ...occasions[1], year: occasions[1].year + 1 }],
    })).data.occasions).toHaveLength(2);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { occasionIds: occasions.slice(0, 1) })).data.occasions).toHaveLength(1);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { status: 'gifted' })).status).toBe(409);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { status: 'purchased' })).status).toBe(200);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { status: 'reserved' })).status).toBe(200);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { status: 'purchased' })).status).toBe(200);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { status: 'wrapped' })).status).toBe(200);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { status: 'gifted' })).status).toBe(200);
    expect((await call('alice', `/reservations/${id}`, 'PATCH', { status: 'reserved' })).status).toBe(409);
    expect((await call('bob', '/wishes')).data.some((w: {id:string}) => w.id === wish.data.id)).toBe(false);
    expect((await call('bob', '/history')).data.some((h: {snapshot:{id:string}}) => h.snapshot.id === wish.data.id)).toBe(true);
    expect((await call('bob', '/history')).data.find((h: {snapshot:{id:string}}) => h.snapshot.id === wish.data.id)
      .snapshot.recipient.first_name).toBe('Bob');
    expect((await call('charlie', '/history')).data.some((h: {snapshot:{id:string}}) => h.snapshot.id === wish.data.id)).toBe(true);
    expect((await call('david', '/history')).data.some((h: {snapshot:{id:string}}) => h.snapshot.id === wish.data.id)).toBe(false);
  });
});
