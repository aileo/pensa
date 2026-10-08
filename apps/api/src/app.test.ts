import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { app } from './app.js';
import { pool } from './db.js';

let server: Server;
let base: string;
const cookies: Record<string, string> = {};
// A client address can be supplied so a test that signs in and out repeatedly gets its own
// rate-limit budget instead of spending the one shared by the whole suite.
const call = async (as: string, path: string, method = 'GET', body?: unknown, language?: string, ip?: string) => {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'content-type': 'application/json', cookie: cookies[as] ?? '', origin: 'http://localhost:5173',
      ...(language ? { 'accept-language': language } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) },
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
    const login = await call('', '/auth/login', 'POST', { email: `${name}@example.test`, password: 'PensaDemo2026!' });
    if (login.status !== 200) throw new Error('Exécuter le seed avant les tests');
    cookies[name] = login.cookie!.split(';')[0];
  }
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
});
describe('permissions métier sur l’API', () => {
  it('localise les erreurs d’authentification et de validation selon Accept-Language', async () => {
    expect(await call('', '/auth/me', 'GET', undefined, 'en-US,en;q=0.9,fr;q=0.5'))
      .toMatchObject({ status: 401, data: { error: 'Authentication required' } });
    expect(await call('', '/auth/me'))
      .toMatchObject({ status: 401, data: { error: 'Connexion requise' } });
    expect(await call('', '/auth/me', 'GET', undefined, 'de,es;q=0.8'))
      .toMatchObject({ status: 401, data: { error: 'Connexion requise' } });
    expect(await call('', '/auth/me', 'GET', undefined, 'fr-CA, en;q=0.4'))
      .toMatchObject({ status: 401, data: { error: 'Connexion requise' } });
    expect(await call('', '/auth/me', 'GET', undefined, 'fr;q=0.2,en-GB;q=0.9'))
      .toMatchObject({ status: 401, data: { error: 'Authentication required' } });
    expect(await call('', '/auth/login', 'POST', { email: 'alice@example.test', password: 'wrong' }, 'en'))
      .toMatchObject({ status: 401, data: { error: 'Invalid credentials' } });
    expect(await call('', '/auth/register', 'POST', { email: 'bad' }, 'en'))
      .toMatchObject({ status: 400, data: { error: 'Invalid data' } });
    expect(await call('', '/auth/register', 'POST', {
      firstName: 'Duplicate', lastName: 'User', email: 'alice@example.test',
      password: 'LongSecret2026!', birthDate: '2000-01-02',
    }, 'en')).toMatchObject({ status: 409, data: { error: 'Conflict' } });
    const malformed = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'accept-language': 'en',
        origin: 'http://localhost:5173' }, body: '{broken',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'Invalid data' });
  });
  it('localise les refus SSRF, les URL invalides et les ressources inconnues en JSON', async () => {
    expect(await call('bob', '/wishes/preview', 'POST', { url: 'http://127.0.0.1/' }, 'en'))
      .toMatchObject({ status: 400, data: { error: 'Address not allowed' } });
    expect(await call('bob', '/wishes/preview', 'POST', { url: 'http://127.0.0.1/' }))
      .toMatchObject({ status: 400, data: { error: 'Adresse non autorisée' } });
    expect(await call('bob', '/wishes/preview', 'POST', { url: 'not-an-url' }, 'en'))
      .toMatchObject({ status: 400, data: { error: 'Invalid data' } });
    expect(await call('bob', '/no-such-route', 'GET', undefined, 'en'))
      .toMatchObject({ status: 404, data: { error: 'Resource not found' } });
  });
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
  it('calcule le prochain anniversaire du 29 février sur une année bissextile', async () => {
    const registered = await call('', '/auth/register', 'POST', {
      firstName: 'Leap', lastName: 'Year', email: `leap-${Date.now()}@example.test`,
      password: 'LongSecret2026!', birthDate: '2000-02-29',
    });
    cookies.leap = registered.cookie!.split(';')[0];
    await call('leap', '/families', 'POST', { name: 'Famille bissextile' });
    const birthday = (await call('leap', '/occasions')).data.find((o: {kind:string}) => o.kind === 'birthday');
    expect(birthday.nextDate).toMatch(/^\d{4}-02-29$/);
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
  it('exige le consentement du foyer avant rattachement et empêche une révocation qui orphelinerait un cadeau', async () => {
    const familyA = (await call('alice', '/families')).data.find((f: {name:string}) => f.name === 'Famille A');
    const registered = await call('', '/auth/register', 'POST', {
      firstName: 'Guest', lastName: 'Family', email: `family-${Date.now()}@example.test`,
      password: 'LongSecret2026!', birthDate: '1995-07-10',
    });
    cookies.guest = registered.cookie!.split(';')[0];
    const householdId = registered.data.householdId;
    expect((await call('alice', `/families/${familyA.id}/households`, 'POST', { householdId })).status).toBe(404);
    expect((await call('bob', `/families/${familyA.id}/invitations`, 'POST', {})).status).toBe(403);
    const invite = await call('alice', `/families/${familyA.id}/invitations`, 'POST', {});
    expect(invite.status).toBe(201);
    expect((await call('guest', '/families/join', 'POST', { code: invite.data.code })).status).toBe(201);
    expect((await call('guest', '/families/join', 'POST', { code: invite.data.code })).status).toBe(403);
    const bobId = (await call('bob', '/auth/me')).data.id;
    const wish = await call('bob', '/wishes', 'POST', {
      title: 'Cadeau accès révoqué', url: 'https://example.com', image: 'https://example.com/image.png',
    });
    const event = (await call('guest', `/occasions?recipientId=${bobId}`)).data
      .find((o: {family_id:string;nextDate:string|null}) => o.family_id === familyA.id && o.nextDate);
    const booking = await call('guest', '/reservations', 'POST', {
      wishId: wish.data.id, occasionIds: [{ id: event.id, year: Number(event.nextDate.slice(0, 4)) }],
    });
    expect(booking.status).toBe(201);
    expect((await call('alice', `/families/${familyA.id}/households/${householdId}`, 'DELETE')).status).toBe(409);
    expect((await call('guest', `/reservations/${booking.data.id}`, 'DELETE')).status).toBe(200);
    expect((await call('alice', `/families/${familyA.id}/households/${householdId}`, 'DELETE')).status).toBe(200);
    expect((await call('guest', '/reservations')).data.some((r: {id:string}) => r.id === booking.data.id)).toBe(false);
    expect((await call('guest', `/reservations/${booking.data.id}`)).status).toBe(404);
    await call('bob', `/wishes/${wish.data.id}`, 'DELETE');
  });
  it('refuse une demande en attente après retrait du foyer et cache la réservation du dashboard', async () => {
    const familyA = (await call('alice', '/families')).data.find((f: {name:string}) => f.name === 'Famille A');
    const registered = await call('', '/auth/register', 'POST', {
      firstName: 'Pending', lastName: 'Guest', email: `pending-${Date.now()}@example.test`,
      password: 'LongSecret2026!', birthDate: '1995-07-10',
    });
    expect(registered.status).toBe(201);
    cookies.pending = registered.cookie!.split(';')[0];
    const invite = await call('alice', `/families/${familyA.id}/invitations`, 'POST', {});
    expect((await call('pending', '/families/join', 'POST', { code: invite.data.code })).status).toBe(201);
    const bobId = (await call('bob', '/auth/me')).data.id;
    const wish = (await call('alice', `/users/${bobId}/wishes`)).data
      .find((w: {reservation?: {openToContributions?: boolean}}) => w.reservation?.openToContributions);
    expect(wish.reservation.creator.firstName).toBe('Alice');
    const requested = await call('pending', `/reservations/${wish.reservation.id}/requests`, 'POST', {});
    expect(requested.status).toBe(201);
    expect((await call('alice', `/families/${familyA.id}/households/${registered.data.householdId}`, 'DELETE')).status).toBe(200);
    expect((await call('alice', `/reservations/${wish.reservation.id}/requests/${requested.data.id}`, 'PATCH',
      { status: 'accepted' })).status).toBe(403);
    await pool.query('INSERT INTO participants(reservation_id,user_id) VALUES($1,$2)',
      [wish.reservation.id, registered.data.id]);
    try {
      const dashboard = await call('pending', '/dashboard');
      expect(dashboard.data.participating.some((r: {id:string}) => r.id === wish.reservation.id)).toBe(false);
      expect((await call('pending', '/reservations')).data.some((r: {id:string}) => r.id === wish.reservation.id)).toBe(false);
    } finally {
      await pool.query('DELETE FROM participants WHERE reservation_id=$1 AND user_id=$2',
        [wish.reservation.id, registered.data.id]);
    }
  });
  it('ne retourne aucun souhait inaccessible dans la recherche et les filtres', async () => {
    const isolated = await call('eloise', '/search?q=Console');
    expect(isolated.data.wishes).toHaveLength(0);
    const shared = await call('alice', '/search?q=Console');
    expect(shared.data.wishes.some((w: {title:string}) => w.title === 'Console de jeux')).toBe(true);
    const bobId = (await call('bob', '/auth/me')).data.id;
    const filtered = await call('alice', `/users/${bobId}/wishes?availability=reserved&maxPrice=400`);
    expect(filtered.data.some((w: {title:string}) => w.title === 'Console de jeux')).toBe(true);
    expect(filtered.data.every((w: {reservation?:object}) => !!w.reservation)).toBe(true);
    expect((await call('alice', `/users/${bobId}/wishes?maxPrice=invalid`)).status).toBe(400);
    const tagged = await call('bob', '/wishes', 'POST', {
      title: 'Test recherche', url: 'https://example.com', image: 'https://example.com/image.png',
      tags: ['unique-search-tag'], price: 12,
    });
    expect((await call('alice', '/search?q=unique-search-tag')).data.wishes.some((w: {id:string}) => w.id === tagged.data.id)).toBe(true);
    expect((await call('alice', `/users/${bobId}/wishes?tag=unique-search-tag&minPrice=10&maxPrice=20`)).data)
      .toHaveLength(1);
    await call('bob', `/wishes/${tagged.data.id}`, 'DELETE');
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
    const withoutImage = await call('bob', '/wishes', 'POST', { title: 'Sans image', url: 'https://example.com' });
    expect(withoutImage.status).toBe(201);
    expect(withoutImage.data).toMatchObject({ title: 'Sans image', image: null });
    expect((await call('bob', '/wishes', 'POST', { title: 'Image invalide', url: 'https://example.com', image: 'ftp://example.com/i.png' })).status).toBe(400);
    expect((await call('bob', '/wishes/preview', 'POST', { url: 'http://127.0.0.1/' })).status).toBe(400);
    expect((await call('bob', '/wishes/preview', 'POST', { url: 'not-an-url' })).status).toBe(400);
    const wishes = await call('bob', '/wishes');
    const wish = wishes.data[0];
    expect((await call('bob', `/wishes/${wish.id}`, 'PATCH', { title: 'Changé', tags: ['test'] })).status).toBe(400);
    expect((await call('bob', `/wishes/${wish.id}`, 'PATCH', { tags: ['test'] })).status).toBe(200);
    await call('bob', `/wishes/${wish.id}`, 'PATCH', { tags: wish.tags });
  });
  it('empêche une double réservation concurrente et conserve la confidentialité après suppression', async () => {
    const created = await call('bob', '/wishes', 'POST', {
      title: 'Test concurrent', url: 'https://example.com', image: 'https://example.com/image.png', tags: [],
    });
    expect(created.status).toBe(201);
    const wishId = created.data.id;
    const occasions = await call('charlie', `/occasions?recipientId=${(await call('bob', '/auth/me')).data.id}`);
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
  it('dédoublonne les occasions identiques et exclut celles de l’utilisateur connecté du dashboard', async () => {
    const aliceId = (await call('alice', '/auth/me')).data.id;
    const bobId = (await call('bob', '/auth/me')).data.id;
    const keys = (rows: {name:string;kind:string;month:number|null;day:number|null}[]) => rows.map(o => JSON.stringify([o.name, o.kind, o.month, o.day]));
    const bobOccasions = keys((await call('alice', `/occasions?recipientId=${bobId}`)).data as never);
    expect(new Set(bobOccasions).size).toBe(bobOccasions.length);
    expect(bobOccasions.length).toBeGreaterThan(0);
    const dashboard = (await call('alice', '/dashboard')).data.occasions as {name:string;kind:string;nextDate:string;person:{id:string}}[];
    expect(dashboard.some(o => o.person.id === aliceId)).toBe(false);
    const dashboardKeys = dashboard.map(o => JSON.stringify([o.person.id, o.name, o.kind, o.nextDate]));
    expect(new Set(dashboardKeys).size).toBe(dashboardKeys.length);
  });
  it('expose l’envie et le bénéficiaire dans les réservations', async () => {
    const reservation = (await call('alice', '/reservations')).data.find((r: {wish?:{title:string}}) => r.wish?.title === 'Console de jeux');
    expect(reservation).toMatchObject({ wish: { title: 'Console de jeux' }, recipient: { firstName: 'Bob' } });
  });
  it('guide l’utilisateur avec une liste de démarrage et des actions à faire', async () => {
    const alice = (await call('alice', '/dashboard')).data;
    expect(alice.onboarding).toEqual({ hasWishes: true, hasSharedFamily: true, hasNameDay: true, hasReservation: true });
    const pending = alice.todos.find((t: {type:string}) => t.type === 'pending_requests');
    expect(pending.count).toBeGreaterThanOrEqual(1);
    expect(typeof pending.reservation.wishTitle).toBe('string');
    const aliceId = (await call('alice', '/auth/me')).data.id;
    expect(alice.todos.some((t: {person?:{id:string}}) => t.person?.id === aliceId)).toBe(false);
    const buy = alice.todos.find((t: {type:string;reservation?:{wishTitle:string}}) => t.type === 'reservation_to_buy' && t.reservation?.wishTitle === 'Console de jeux');
    expect(buy).toMatchObject({ person: { firstName: 'Bob' }, reservation: { status: 'reserved' } });
    expect(typeof buy.urgent).toBe('boolean');
    const charlie = (await call('charlie', '/dashboard')).data.todos as {type:string;reservation?:{wishTitle:string}}[];
    expect(charlie.some(t => t.type === 'reservation_to_wrap' && t.reservation?.wishTitle === 'Roman illustré')).toBe(true);
    expect(charlie.some(t => t.reservation?.wishTitle === 'Console de jeux' && t.type !== 'pending_requests')).toBe(false);
    const bob = (await call('bob', '/dashboard')).data.todos as {type:string}[];
    expect(bob.some(t => t.type.startsWith('reservation_to_'))).toBe(false);
    expect((await call('leap', '/dashboard')).data).toMatchObject({
      todos: [], onboarding: { hasWishes: false, hasSharedFamily: false, hasNameDay: false, hasReservation: false },
    });
  });
  it('réserve la gestion du foyer et le rattachement aux familles aux admins du foyer', async () => {
    cookies.owner = cookies.leap;
    const owner = await call('owner', '/auth/me');
    expect(owner.data.householdAdmin).toBe(true);
    const householdId = owner.data.householdId;
    const invite = await call('owner', `/households/${householdId}/invitations`, 'POST', {});
    const member = await call('', '/auth/register', 'POST', {
      firstName: 'Member', lastName: 'Home', email: `member-${Date.now()}@example.test`, password: 'LongSecret2026!',
      birthDate: '1982-01-01', invitation: invite.data.code,
    });
    cookies.member = member.cookie!.split(';')[0];
    expect(member.data.householdAdmin).toBe(false);
    const mine = (await call('member', '/households/mine')).data;
    expect(mine.id).toBe(householdId);
    expect(mine.members.map((m: {firstName:string;householdAdmin:boolean}) => [m.firstName, m.householdAdmin]))
      .toEqual([['Leap', true], ['Member', false]]);
    expect((await call('member', '/families', 'POST', { name: 'Interdit' })).status).toBe(403);
    const familyA = (await call('alice', '/families')).data.find((f: {name:string}) => f.name === 'Famille A');
    const familyInvite = await call('alice', `/families/${familyA.id}/invitations`, 'POST', {});
    expect((await call('member', '/families/join', 'POST', { code: familyInvite.data.code })).status).toBe(403);
    expect((await call('member', `/households/${householdId}/members/${member.data.id}`, 'PATCH', { admin: true })).status).toBe(403);
    expect((await call('member', `/households/${householdId}/members/${member.data.id}`, 'PATCH', { admin: 'true' })).status).toBe(403);
    expect((await call('charlie', `/households/${householdId}/members/${member.data.id}`, 'PATCH', { admin: true })).status).toBe(403);
    expect((await call('owner', `/households/${householdId}/members/${owner.data.id}`, 'PATCH', { admin: false }, 'en')))
      .toMatchObject({ status: 409, data: { error: 'A household must retain an administrator' } });
    expect((await call('owner', `/households/${householdId}/members/${member.data.id}`, 'PATCH', { admin: true })).status).toBe(200);
    expect((await call('member', '/auth/me')).data.householdAdmin).toBe(true);
    expect((await call('member', `/households/${householdId}/members/${owner.data.id}`, 'PATCH', { admin: false })).status).toBe(200);
    expect((await call('owner', '/families', 'POST', { name: 'Refusé' })).status).toBe(403);
    expect((await call('member', '/families/join', 'POST', { code: familyInvite.data.code })).status).toBe(201);
    const family = (await call('alice', '/families')).data.find((f: {id:string}) => f.id === familyA.id);
    const home = family.households.find((h: {id:string}) => h.id === householdId);
    expect(home.members.map((m: {firstName:string;householdAdmin:boolean;familyAdmin:boolean}) => [m.firstName, m.householdAdmin, m.familyAdmin]))
      .toEqual([['Leap', false, false], ['Member', true, false]]);
    const aliceEntry = family.households.flatMap((h: {members:{firstName:string;familyAdmin:boolean}[]}) => h.members)
      .find((m: {firstName:string}) => m.firstName === 'Alice');
    expect(aliceEntry.familyAdmin).toBe(true);
    const visible = (await call('alice', '/households')).data;
    expect(visible.find((h: {id:string}) => h.id === householdId).members).toHaveLength(2);
    expect(visible.filter((h: {mine:boolean}) => h.mine)).toHaveLength(1);
    await call('alice', `/families/${familyA.id}/households/${householdId}`, 'DELETE');
  });
  it('rend le statut offert irréversible et protège l’historique', async () => {
    const history = await call('alice', '/history');
    expect(history.data.length).toBeGreaterThan(0);
    expect((await call('eloise', '/history')).data).toHaveLength(0);
    const bobReservations = await call('bob', '/reservations');
    const gifted = bobReservations.data.find((r: {status:string}) => r.status === 'gifted');
    expect(gifted).toBeTruthy();
    expect((await call('alice', `/reservations/${gifted.id}`)).status).toBe(404);
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
    const dated = (await call('alice', `/occasions?recipientId=${bobId}`)).data
      .filter((o: {nextDate:string|null}) => o.nextDate) as {id:string;nextDate:string}[];
    const choices = dated.flatMap(o => [0, 1].map(offset => ({ id: o.id, year: Number(o.nextDate.slice(0, 4)) + offset, date: `${Number(o.nextDate.slice(0, 4)) + offset}${o.nextDate.slice(4)}` })));
    const ordered = (await call('alice', `/reservations/${id}`, 'PATCH', {
      occasionIds: [...choices].reverse().map(({ id: occasionId, year }) => ({ id: occasionId, year })),
    })).data.occasions as {id:string;year:number;kind:string}[];
    expect(ordered.map(o => `${o.id}-${o.year}`)).toEqual([...choices].sort((a, b) => a.date.localeCompare(b.date)).map(o => `${o.id}-${o.year}`));
    expect(ordered.every(o => o.kind)).toBe(true);
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
  it('gère les cadeaux hors liste sans les révéler au bénéficiaire', async () => {
    const bobId = (await call('bob', '/auth/me')).data.id;
    const occasions = (await call('alice', `/occasions?recipientId=${bobId}`)).data
      .filter((o: {nextDate:string|null}) => o.nextDate).slice(0, 1)
      .map((o: {id:string;nextDate:string}) => ({ id: o.id, year: Number(o.nextDate.slice(0, 4)) }));
    expect((await call('alice', '/reservations/off-list', 'POST', { recipientId: bobId, occasionIds: occasions })).status).toBe(400);
    expect((await call('bob', '/reservations/off-list', 'POST', { recipientId: bobId, title: 'Moi', occasionIds: occasions })).status).toBe(403);
    expect((await call('eloise', '/reservations/off-list', 'POST', { recipientId: bobId, title: 'X', occasionIds: occasions })).status).toBe(403);
    const hidden = await call('alice', '/reservations/off-list', 'POST', { recipientId: bobId, title: 'Surprise privée', occasionIds: occasions });
    expect(hidden.status).toBe(201);
    expect(hidden.data).toMatchObject({ offList: true, openToContributions: false, wish: { title: 'Surprise privée', url: null, image: null } });
    const open = await call('alice', '/reservations/off-list', 'POST', {
      recipientId: bobId, title: 'Cadeau commun', description: 'À plusieurs', price: 120, url: 'https://example.com/gift',
      occasionIds: occasions, openToContributions: true,
    });
    expect(open.status).toBe(201);
    const wishIds = [hidden.data.wish.id, open.data.wish.id];
    expect((await call('bob', '/wishes')).data.some((w: {id:string}) => wishIds.includes(w.id))).toBe(false);
    expect((await call('charlie', `/users/${bobId}/wishes`)).data.some((w: {id:string}) => wishIds.includes(w.id))).toBe(false);
    expect((await call('bob', `/wishes/${open.data.wish.id}`)).status).toBe(404);
    expect((await call('charlie', `/wishes/${open.data.wish.id}`)).status).toBe(404);
    expect((await call('charlie', '/search?q=Cadeau commun')).data.wishes).toHaveLength(0);
    expect((await call('bob', `/users/${bobId}/off-list`)).data).toEqual([]);
    expect((await call('bob', `/reservations/${open.data.id}`)).status).toBe(404);
    expect((await call('bob', `/wishes/${open.data.wish.id}`, 'DELETE')).status).toBe(404);
    expect((await call('alice', '/reservations', 'POST', { wishId: open.data.wish.id, occasionIds: occasions })).status).toBe(404);
    const charlieView = (await call('charlie', `/users/${bobId}/off-list`)).data as {id:string;requestStatus:string|null}[];
    expect(charlieView.some(g => g.id === open.data.id)).toBe(true);
    expect(charlieView.some(g => g.id === hidden.data.id)).toBe(false);
    expect((await call('alice', `/users/${bobId}/off-list`)).data.some((g: {id:string}) => g.id === hidden.data.id)).toBe(true);
    const dashboard = (await call('charlie', '/dashboard')).data.openGifts as {id:string}[];
    expect(dashboard.some(g => g.id === open.data.id)).toBe(true);
    expect(dashboard.some(g => g.id === hidden.data.id)).toBe(false);
    expect((await call('alice', '/dashboard')).data.openGifts.some((g: {id:string}) => g.id === open.data.id)).toBe(false);
    expect((await call('charlie', `/reservations/${open.data.id}/requests`, 'POST')).status).toBe(201);
    expect((await call('charlie', `/users/${bobId}/off-list`)).data.find((g: {id:string}) => g.id === open.data.id).requestStatus).toBe('pending');
    expect((await call('charlie', `/reservations/${hidden.data.id}/requests`, 'POST')).status).toBe(409);
    const edited = await call('alice', `/reservations/${open.data.id}`, 'PATCH', { gift: { title: 'Cadeau commun XL', price: 150 } });
    expect(edited.data.wish).toMatchObject({ title: 'Cadeau commun XL', price: '150.00', url: null });
    const consoleRes = (await call('alice', '/reservations')).data.find((r: {wish?:{title:string}}) => r.wish?.title === 'Console de jeux');
    expect((await call('alice', `/reservations/${consoleRes.id}`, 'PATCH', { gift: { title: 'Nope' } })).status).toBe(409);
    expect((await call('alice', `/reservations/${hidden.data.id}`, 'DELETE')).status).toBe(200);
    expect((await call('alice', `/users/${bobId}/off-list`)).data.some((g: {id:string}) => g.id === hidden.data.id)).toBe(false);
    expect((await call('alice', `/reservations/${open.data.id}`, 'DELETE')).status).toBe(200);
  });
  it('accepte l’origine reconstituée derrière un proxy et refuse les autres', async () => {
    // Exactly what nginx sends when the site is served over HTTPS on its own domain: the
    // browser's Origin is the public address, which the API never had configured anywhere.
    const proxied = async (origin: string, forwardedHost: string) => (await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin,
        'x-forwarded-proto': 'https, http', 'x-forwarded-host': forwardedHost },
      body: JSON.stringify({ email: 'alice@example.test', password: 'wrong' }),
    })).status;
    expect(await proxied('https://pensa.example.test', 'pensa.example.test')).toBe(401);
    expect(await proxied('https://attaquant.example.test', 'pensa.example.test')).toBe(403);
    // Without forwarded headers the Host header is the fallback, and WEB_ORIGIN still works.
    expect((await call('', '/auth/login', 'POST', { email: 'alice@example.test', password: 'wrong' })).status).toBe(401);
  });
  it('n’ouvre l’inscription libre que si la configuration l’autorise', async () => {
    expect(await (await fetch(`${base}/api/config`)).json()).toEqual({ openRegistration: true });
    const signUp = (invitation?: string) => call('', '/auth/register', 'POST', {
      firstName: 'Closed', lastName: 'Door', email: `closed-${Date.now()}-${Math.random()}@example.test`,
      password: 'LongSecret2026!', birthDate: '1990-03-04', ...(invitation ? { invitation } : {}),
    }, 'en');
    const familyA = (await call('alice', '/families')).data.find((f: {name:string}) => f.name === 'Famille A');
    const invite = await call('alice', `/families/${familyA.id}/invitations`, 'POST', {});
    process.env.OPEN_REGISTRATION = 'false';
    try {
      // The seeded database is not empty, so the bootstrap exception does not apply.
      expect(await (await fetch(`${base}/api/config`)).json()).toEqual({ openRegistration: false });
      expect(await signUp()).toMatchObject({ status: 403, data: { error: 'Registration is by invitation only' } });
      expect(await signUp('code-inexistant')).toMatchObject({ status: 403, data: { error: 'Invalid or expired invitation' } });
      // A family code still gets someone in, with a household of their own attached to the family.
      const joined = await signUp(invite.data.code);
      expect(joined.status).toBe(201);
      expect(joined.data).toMatchObject({ householdAdmin: true });
      cookies.familyGuest = joined.cookie!.split(';')[0];
      expect((await call('familyGuest', '/families')).data.some((f: {id:string}) => f.id === familyA.id)).toBe(true);
      expect((await call('familyGuest', '/households/mine')).data.name).toBe('Foyer de Closed');
      await call('alice', `/families/${familyA.id}/households/${joined.data.householdId}`, 'DELETE');
    } finally { process.env.OPEN_REGISTRATION = 'true'; }
  });
  it('confie la liste d’un membre géré aux administrateurs du foyer', async () => {
    // Test people are named uniquely per run, because the suite runs against a database that
    // keeps whatever an earlier failed run left behind.
    const name = (label: string) => `${label}${Date.now().toString(36)}`;
    const ninaName = name('Nina');
    const mine = (await call('alice', '/households/mine')).data;
    const created = await call('alice', `/households/${mine.id}/members`, 'POST',
      { firstName: ninaName, lastName: 'Martin', birthDate: '2015-02-09', nameDay: '01-21' });
    expect(created.status).toBe(201);
    const nina = created.data.members.find((m: {firstName:string}) => m.firstName === ninaName);
    expect(nina).toMatchObject({ managed: true, householdAdmin: false, nameDay: '01-21' });
    // A name day stays inside the household: relatives reading the family never receive it.
    const charlieView = (await call('charlie', '/families')).data
      .flatMap((f: {households?:{members:{id:string;nameDay?:string}[]}[]}) => f.households ?? [])
      .flatMap((h: {members:{id:string;nameDay?:string}[]}) => h.members)
      .find((m: {id:string}) => m.id === nina.id);
    expect(charlieView).toBeTruthy();
    expect(charlieView).not.toHaveProperty('nameDay');
    expect((await call('charlie', '/households')).data
      .flatMap((h: {mine:boolean;members:{id:string}[]}) => h.mine ? [] : h.members)
      .find((m: {id:string}) => m.id === nina.id)).not.toHaveProperty('nameDay');
    // Both parents curate the list; nobody outside the household can.
    const wish = await call('bob', `/users/${nina.id}/wishes`, 'POST',
      { title: 'Patins à roulettes', url: 'https://example.com/patins', price: 55, tags: ['sport'] });
    expect(wish.status).toBe(201);
    expect((await call('charlie', `/users/${nina.id}/wishes`, 'POST',
      { title: 'Interdit', url: 'https://example.com/non' }, 'en')).data.error).toBe('Person not accessible');
    expect((await call('charlie', `/wishes/${wish.data.id}`, 'PATCH', { tags: ['autre'] })).status).toBe(404);
    expect((await call('alice', `/wishes/${wish.data.id}`, 'PATCH', { tags: ['roulettes'] })).status).toBe(200);
    const second = await call('alice', `/users/${nina.id}/wishes`, 'POST',
      { title: 'Casque', url: 'https://example.com/casque', price: 30 });
    expect((await call('alice', `/users/${nina.id}/wishes/order`, 'PATCH',
      { ids: [second.data.id, wish.data.id] })).status).toBe(200);
    expect((await call('alice', `/users/${nina.id}/wishes`)).data.map((w: {title:string}) => w.title))
      .toEqual(['Casque', 'Patins à roulettes']);
    // Relatives see the list like any other, through the family they share.
    expect((await call('charlie', `/users/${nina.id}/wishes`)).data).toHaveLength(2);
    // Administration needs someone who can sign in.
    expect((await call('alice', `/households/${mine.id}/members/${nina.id}`, 'PATCH', { admin: true }, 'en')).data.error)
      .toBe('A managed member cannot administrate');
    const familyA = (await call('alice', '/families')).data.find((f: {name:string}) => f.name === 'Famille A');
    expect((await call('alice', `/families/${familyA.id}/admins`, 'POST', { userId: nina.id }, 'en')).data.error)
      .toBe('A managed member cannot administrate');
    // Profile edits are reserved for managed members.
    expect((await call('alice', `/households/${mine.id}/members/${nina.id}`, 'PATCH', { firstName: `${ninaName}lle` })).status).toBe(200);
    // The whole record, name day included, stays editable afterwards.
    expect((await call('alice', `/households/${mine.id}/members/${nina.id}`, 'PATCH', { nameDay: '99-99' })).status).toBe(400);
    const edited = await call('alice', `/households/${mine.id}/members/${nina.id}`, 'PATCH',
      { birthDate: '2015-03-08', nameDay: '05-30' });
    expect(edited.data.members.find((m: {id:string}) => m.id === nina.id))
      .toMatchObject({ birthDate: '2015-03-08', nameDay: '05-30' });
    expect((await call('alice', '/households/mine')).data.members.find((m: {id:string}) => m.id === nina.id).nameDay).toBe('05-30');
    expect((await call('alice', `/households/${mine.id}/members/${nina.id}`, 'PATCH', { nameDay: null })).data
      .members.find((m: {id:string}) => m.id === nina.id).nameDay).toBeNull();
    const bobId = (await call('alice', '/households/mine')).data.members.find((m: {firstName:string}) => m.firstName === 'Bob').id;
    expect((await call('alice', `/households/${mine.id}/members/${bobId}`, 'PATCH', { firstName: 'Bobby' }, 'en')).data.error)
      .toBe('This member manages their own account');
    await call('alice', `/wishes/${wish.data.id}`, 'DELETE');
    await call('alice', `/wishes/${second.data.id}`, 'DELETE');
    expect((await call('alice', `/households/${mine.id}/members/${nina.id}`, 'DELETE')).status).toBe(200);
  });
  it('convertit un membre géré en compte indépendant puis le laisse partir', async () => {
    const name = (label: string) => `${label}${Date.now().toString(36)}`;
    const mine = (await call('alice', '/households/mine')).data;
    const add = async (firstName: string) => (await call('alice', `/households/${mine.id}/members`, 'POST',
      { firstName, lastName: 'Martin', birthDate: '2008-07-03' }))
      .data.members.find((m: {firstName:string}) => m.firstName === firstName);
    const theoName = name('Theo');
    const theo = await add(theoName);
    const invitation = await call('alice', `/households/${mine.id}/members/${theo.id}/invitations`, 'POST', {});
    expect(invitation.status).toBe(201);
    // A claim code attaches credentials to a person who already exists; it never creates one.
    expect((await call('', '/auth/register', 'POST', { firstName: 'Faux', lastName: 'Compte',
      email: `faux-${Date.now()}@example.test`, password: 'LongSecret2026!', birthDate: '1990-01-01',
      invitation: invitation.data.code }, 'en', '10.9.0.1')).data.error).toBe('Invalid or expired invitation');
    const claim = await call('', '/auth/claim', 'POST',
      { code: invitation.data.code, email: `theo-${Date.now()}@example.test`, password: 'LongSecret2026!' }, undefined, '10.9.0.1');
    expect(claim.status).toBe(200);
    expect(claim.data).toMatchObject({ id: theo.id, firstName: theoName, managed: false, householdAdmin: false });
    cookies.theo = claim.cookie!.split(';')[0];
    expect((await call('', '/auth/claim', 'POST',
      { code: invitation.data.code, email: `autre-${Date.now()}@example.test`, password: 'LongSecret2026!' }, 'en', '10.9.0.1')).data.error)
      .toBe('Invalid or expired claim code');
    // Once independent the list belongs to them, and nobody else may write in it.
    expect((await call('alice', `/users/${theo.id}/wishes`, 'POST',
      { title: 'Interdit', url: 'https://example.com/non' }, 'en')).data.error).toBe('Person not accessible');
    // The direct route covers the case where the administrator sets the password themselves.
    const jadeId = (await add(name('Jade'))).id;
    const jadeEmail = `jade-${Date.now()}@example.test`;
    expect((await call('alice', `/households/${mine.id}/members/${jadeId}/account`, 'POST',
      { email: jadeEmail, password: 'LongSecret2026!' })).status).toBe(200);
    expect((await call('alice', `/households/${mine.id}/members/${jadeId}/account`, 'POST',
      { email: `encore-${Date.now()}@example.test`, password: 'LongSecret2026!' }, 'en')).data.error)
      .toBe('This member manages their own account');
    const jade = await call('', '/auth/login', 'POST', { email: jadeEmail, password: 'LongSecret2026!' }, undefined, '10.9.0.1');
    expect(jade.status).toBe(200);
    cookies.jade = jade.cookie!.split(';')[0];
    // Moving out needs an account, so it is refused while the person is still managed.
    const enzoId = (await add(name('Enzo'))).id;
    expect((await call('alice', `/households/${mine.id}/members/${enzoId}/move-out`, 'POST', {}, 'en')).data.error)
      .toBe('An independent account is required');
    expect((await call('alice', `/households/${mine.id}/members/${enzoId}`, 'DELETE')).status).toBe(200);
    // Either the person or an administrator can trigger it; the new household keeps the families.
    const families = (await call('theo', '/families')).data.map((f: {id:string}) => f.id).sort();
    const moved = await call('theo', `/households/${mine.id}/members/${theo.id}/move-out`, 'POST', {});
    expect(moved.status).toBe(200);
    expect(moved.data.householdId).not.toBe(mine.id);
    const own = await call('theo', '/households/mine');
    expect(own.data.name).toBe(`Foyer de ${theoName}`);
    expect(own.data.members.map((m: {id:string}) => m.id)).toEqual([theo.id]);
    expect((await call('theo', '/auth/me')).data.householdAdmin).toBe(true);
    expect((await call('theo', '/families')).data.map((f: {id:string}) => f.id).sort()).toEqual(families);
    // Alice still sees him, because both households belong to the same families.
    expect((await call('alice', '/users')).data.some((p: {id:string}) => p.id === theo.id)).toBe(true);
    const jadeHousehold = (await call('alice', `/households/${mine.id}/members/${jadeId}/move-out`, 'POST', {})).data.householdId;
    expect(jadeHousehold).toBeTruthy();
    for (const family of (await call('jade', '/families')).data as unknown as {id: string}[])
      await call('alice', `/families/${family.id}/households/${jadeHousehold}`, 'DELETE');
    for (const family of (await call('theo', '/families')).data as unknown as {id: string}[])
      await call('alice', `/families/${family.id}/households/${moved.data.householdId}`, 'DELETE');
  });
  it('édite les champs optionnels d’un souhait, réservé ou non, sans jamais toucher au titre ni à la réservation', async () => {
    // Dedicated rate-limit budget: this test alone makes well over a dozen calls, enough to
    // threaten the shared suite-wide budget once combined with every other test file.
    const editIp = '10.9.0.2';
    const bobId = (await call('bob', '/auth/me', 'GET', undefined, undefined, editIp)).data.id;
    // Unreserved: every optional field can be added, updated and cleared; a partial call only
    // ever touches the keys it sends, and the title is never one of them.
    const created = await call('bob', '/wishes', 'POST', {
      title: 'Edition libre', url: 'https://example.com/a', image: 'https://example.com/a.png',
      description: 'Avant', price: 10, tags: ['un'],
    }, undefined, editIp);
    expect(created.status).toBe(201);
    const wishId = created.data.id;
    const priceOnly = await call('bob', `/wishes/${wishId}`, 'PATCH', { price: 20 }, undefined, editIp);
    expect(priceOnly.status).toBe(200);
    expect(priceOnly.data).toMatchObject({
      title: 'Edition libre', url: 'https://example.com/a', image: 'https://example.com/a.png',
      description: 'Avant', price: '20.00', tags: ['un'],
    });
    const cleared = await call('bob', `/wishes/${wishId}`, 'PATCH', { url: '', image: null, description: null, price: null }, undefined, editIp);
    expect(cleared.status).toBe(200);
    expect(cleared.data).toMatchObject({ title: 'Edition libre', url: null, image: null, description: null, price: null, tags: ['un'] });
    const restored = await call('bob', `/wishes/${wishId}`, 'PATCH', {
      url: 'https://example.com/b', image: 'https://example.com/b.png', description: 'Après', price: 30, tags: ['deux'],
    }, undefined, editIp);
    expect(restored.status).toBe(200);
    expect(restored.data).toMatchObject({
      url: 'https://example.com/b', image: 'https://example.com/b.png', description: 'Après', price: '30.00', tags: ['deux'],
    });
    // Invalid values are rejected and leave the wish untouched.
    expect((await call('bob', `/wishes/${wishId}`, 'PATCH', { price: -1 }, undefined, editIp)).status).toBe(400);
    expect((await call('bob', `/wishes/${wishId}`, 'PATCH', { price: '20' }, undefined, editIp)).status).toBe(400);
    expect((await call('bob', `/wishes/${wishId}`, 'PATCH', { price: '' }, undefined, editIp)).status).toBe(400);
    expect((await call('bob', `/wishes/${wishId}`, 'PATCH', { url: 'ftp://example.com/x' }, undefined, editIp)).status).toBe(400);
    expect((await call('bob', `/wishes/${wishId}`, 'PATCH', { title: 'Jamais' }, undefined, editIp)).status).toBe(400);
    expect((await call('bob', `/wishes/${wishId}`, 'PATCH', { somethingElse: true }, undefined, editIp)).status).toBe(400);
    expect((await call('bob', `/wishes/${wishId}`, 'GET', undefined, undefined, editIp)).data).toMatchObject({ url: 'https://example.com/b', price: '30.00' });
    // A family member who neither owns nor curates the list cannot edit it: the privacy rule
    // answers 404, the same as an unknown wish.
    expect((await call('charlie', `/wishes/${wishId}`, 'PATCH', { price: 99 }, undefined, editIp)).status).toBe(404);
    // Reserved: editing optional fields never detaches, cancels or alters the reservation.
    const occasions = await call('alice', `/occasions?recipientId=${bobId}`, 'GET', undefined, undefined, editIp);
    const choice = occasions.data.find((o: {nextDate:string|null}) => o.nextDate);
    const reservation = await call('alice', '/reservations', 'POST', {
      wishId, occasionIds: [{ id: choice.id, year: Number(choice.nextDate.slice(0, 4)) }],
    }, undefined, editIp);
    expect(reservation.status).toBe(201);
    const editedWhileReserved = await call('bob', `/wishes/${wishId}`, 'PATCH', { description: 'Pendant la réservation' }, undefined, editIp);
    expect(editedWhileReserved.status).toBe(200);
    expect(editedWhileReserved.data.description).toBe('Pendant la réservation');
    expect(editedWhileReserved.data.title).toBe('Edition libre');
    const stillReserved = await call('alice', `/reservations/${reservation.data.id}`, 'GET', undefined, undefined, editIp);
    expect(stillReserved.status).toBe(200);
    expect(stillReserved.data.cancelled).toBe(false);
    expect(stillReserved.data.wishId).toBe(wishId);
    await call('alice', `/reservations/${reservation.data.id}`, 'DELETE', undefined, undefined, editIp);
    await call('bob', `/wishes/${wishId}`, 'DELETE', undefined, undefined, editIp);
    // Managed member: the curating administrators can edit a reserved wish on the child's list
    // the same way, and someone outside the household still cannot.
    const mine = (await call('bob', '/households/mine', 'GET', undefined, undefined, editIp)).data;
    const member = await call('bob', `/households/${mine.id}/members`, 'POST',
      { firstName: `Kid${Date.now().toString(36)}`, lastName: 'Martin', birthDate: '2017-01-01' }, undefined, editIp);
    expect(member.status).toBe(201);
    const kidId = member.data.members.find((m: {firstName:string}) => m.firstName.startsWith('Kid')).id;
    const kidWish = await call('bob', `/users/${kidId}/wishes`, 'POST',
      { title: 'Jouet', url: 'https://example.com/jouet', price: 15, tags: [] }, undefined, editIp);
    expect(kidWish.status).toBe(201);
    const kidOccasions = await call('alice', `/occasions?recipientId=${kidId}`, 'GET', undefined, undefined, editIp);
    const kidChoice = kidOccasions.data.find((o: {nextDate:string|null}) => o.nextDate);
    const kidReservation = await call('alice', '/reservations', 'POST', {
      wishId: kidWish.data.id, occasionIds: [{ id: kidChoice.id, year: Number(kidChoice.nextDate.slice(0, 4)) }],
    }, undefined, editIp);
    expect(kidReservation.status).toBe(201);
    expect((await call('charlie', `/wishes/${kidWish.data.id}`, 'PATCH', { price: 1 }, undefined, editIp)).status).toBe(404);
    const curatorEdit = await call('alice', `/wishes/${kidWish.data.id}`, 'PATCH', { price: 18, url: '' }, undefined, editIp);
    expect(curatorEdit.status).toBe(200);
    expect(curatorEdit.data).toMatchObject({ title: 'Jouet', price: '18.00', url: null });
    const kidStillReserved = await call('alice', `/reservations/${kidReservation.data.id}`, 'GET', undefined, undefined, editIp);
    expect(kidStillReserved.data.cancelled).toBe(false);
    await call('alice', `/reservations/${kidReservation.data.id}`, 'DELETE', undefined, undefined, editIp);
    await call('alice', `/wishes/${kidWish.data.id}`, 'DELETE', undefined, undefined, editIp);
    await call('bob', `/households/${mine.id}/members/${kidId}`, 'DELETE', undefined, undefined, editIp);
  });
});
