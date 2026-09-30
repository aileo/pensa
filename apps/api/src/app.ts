import express, { type Request, type Response, type NextFunction } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { z, ZodError } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { pool, query } from './db.js';
import { createDefaultOccasions } from './family.js';
import { preview } from './metadata.js';

type Person = { id: string; household_id: string; first_name: string; last_name: string; email: string; birth_date: Date | string; name_day: string | null; avatar: string | null; household_admin?: boolean };
type AuthRequest = Request & { person?: Person };
class HttpError extends Error { constructor(public code: number, message: string) { super(message); } }
const fail = (code: number, message: string): never => { throw new HttpError(code, message); };
const english: Record<string, string> = {
  'Accès refusé à cette famille': 'Access to this family denied',
  'Origine interdite': 'Origin not allowed',
  'Invitation invalide ou expirée': 'Invalid or expired invitation',
  'Inscription sur invitation uniquement': 'Registration is by invitation only',
  'Identifiants invalides': 'Invalid credentials',
  'Connexion requise': 'Authentication required',
  'Date de fête invalide': 'Invalid name day',
  'Administration du foyer requise': 'Household administrator access required',
  'Foyer déjà membre': 'Household is already a member',
  'Une famille doit conserver un foyer': 'A family must retain at least one household',
  'Terminer les réservations avant de retirer ce foyer': 'Complete reservations before removing this household',
  'Une famille doit conserver un administrateur': 'A family must retain an administrator',
  'Utilisateur hors famille': 'User is not in this family',
  'Un foyer doit conserver un administrateur': 'A household must retain an administrator',
  'Membre du foyer introuvable': 'Household member not found',
  'Personne inaccessible': 'Person not accessible',
  'Occasion introuvable': 'Occasion not found',
  'Occasion utilisée dans une réservation': 'Occasion is used in a reservation',
  'Souhait introuvable': 'Wish not found',
  'URL invalide': 'Invalid URL',
  'URL non autorisée': 'URL not allowed',
  'Adresse non autorisée': 'Address not allowed',
  'Page inaccessible': 'Page not accessible',
  'Page introuvable': 'Page not found',
  'Site injoignable': 'Site unreachable',
  'Site introuvable': 'Site not found',
  'Le site refuse la prévisualisation': 'The site refused the preview',
  'Trop de redirections': 'Too many redirects',
  'Délai dépassé': 'Request timed out',
  'URL HTTP(S) requise': 'HTTP(S) URL required',
  'Ordre invalide': 'Invalid order',
  'Liste incomplète': 'Incomplete list',
  'Réservation introuvable': 'Reservation not found',
  'Occasion hors des familles communes': 'Occasion is outside shared families',
  'Le bénéficiaire ne peut pas participer': 'The recipient cannot participate',
  'Participant hors des familles du bénéficiaire': 'Participant is not in a family shared with the recipient',
  'Souhait indisponible': 'Wish unavailable',
  'Impossible de réserver son propre souhait': 'Cannot reserve your own wish',
  'Souhait déjà réservé': 'Wish already reserved',
  'Créateur requis': 'Reservation creator access required',
  'Réservation terminée': 'Reservation completed',
  'Souhait supprimé': 'Wish deleted',
  'Transition de statut interdite': 'Status transition not allowed',
  'Participation fermée': 'Participation closed',
  'Déjà participant': 'Already a participant',
  'Demande introuvable': 'Request not found',
  'Impossible de prévoir un cadeau pour soi-même': 'Cannot plan a gift for yourself',
  'Seul un cadeau hors liste peut être modifié': 'Only an off-list gift can be edited',
  'Ressource introuvable': 'Resource not found',
  'Données invalides': 'Invalid data',
  'Conflit': 'Conflict',
  'Corps trop volumineux': 'Request body too large',
  'Erreur serveur': 'Server error',
  'Trop de requêtes': 'Too many requests',
};
const localized = (req: Request, message: string) =>
  req.headers['accept-language']?.split(',').some(part => /^\s*en(?:-|;|$)/i.test(part)) &&
    req.acceptsLanguages('en', 'fr') === 'en'
    ? english[message] ?? english['Erreur serveur'] : message;
const previewErrors = new Set([
  'URL invalide', 'URL non autorisée', 'Adresse non autorisée', 'Page inaccessible',
  'Page introuvable', 'Site injoignable', 'Site introuvable', 'Le site refuse la prévisualisation',
  'Trop de redirections', 'Délai dépassé',
]);
const uuid = z.uuid();
const tags = z.array(z.string().trim().min(1).max(40)).max(20);
const token = () => randomBytes(32).toString('hex');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const first = async <T extends object>(sql: string, args: unknown[] = []) => (await query<T>(sql, args))[0];
const visible = async (viewer: string, owner: string) =>
  viewer === owner || !!(await first(`SELECT 1 FROM users a JOIN memberships ma ON ma.household_id=a.household_id
    JOIN users b ON b.id=$2 JOIN memberships mb ON mb.household_id=b.household_id AND mb.family_id=ma.family_id
    WHERE a.id=$1 LIMIT 1`, [viewer, owner]));
const ownFamily = async (person: Person, familyId: string) => {
  const row = await first(`SELECT 1 FROM memberships m JOIN family_admins fa ON fa.family_id=m.family_id AND fa.user_id=$2
    WHERE m.family_id=$1 AND m.household_id=$3`, [familyId, person.id, person.household_id]);
  if (!row) fail(403, 'Accès refusé à cette famille');
};
const birthday = (p: Person) => p.birth_date instanceof Date ? p.birth_date.toISOString().slice(0, 10) : p.birth_date;
const publicPerson = (p: Person) => ({ id: p.id, firstName: p.first_name, lastName: p.last_name, avatar: p.avatar, birthDate: birthday(p) });
const privatePerson = (p: Person) => ({ ...publicPerson(p), email: p.email, householdId: p.household_id, nameDay: p.name_day, householdAdmin: !!p.household_admin });
const requireHouseholdAdmin = async (p: Person) => {
  if (!await first('SELECT 1 FROM users WHERE id=$1 AND household_admin=true', [p.id]))
    fail(403, 'Administration du foyer requise');
};
const householdMembers = async (householdId: string) =>
  (await query<Person>('SELECT * FROM users WHERE household_id=$1 ORDER BY first_name', [householdId]))
    .map(p => ({ ...publicPerson(p), householdAdmin: !!p.household_admin }));
// Secure follows the scheme the request actually arrived on, not NODE_ENV. A production image
// reached over plain http — a first run on a bare server, before TLS is in front — would
// otherwise set a cookie the browser refuses to send back, and login would appear to succeed
// and then silently fail. req.secure reads the forwarded proto, so a proxied https request
// still gets the flag.
const sessionCookie = (res: Response, value: string, req: Request) => res.cookie('session', value, {
  httpOnly: true, secure: req.secure, sameSite: 'lax', path: '/', maxAge: 14 * 86400_000,
});
const person = (req: Request) => (req as AuthRequest).person!;
// Everything the app knows about living behind a reverse proxy.
//
// The interface calls /api on its own origin, so a legitimate write is always same-origin.
// That is the real check: does Origin match the URL this request actually arrived at? Deriving
// it from the forwarded headers means nothing to configure, however many proxies are in front.
//
// Trusting X-Forwarded-Host here is safe against CSRF: a malicious page cannot set it. It is
// not a CORS-safelisted header, so the browser sends a preflight first, and the preflight answer
// below only allows Content-Type and Accept-Language. A non-browser client can forge any header,
// but it has no victim's cookie to ride on — there is no CSRF to commit.
//
// WEB_ORIGIN stays as an explicit allowlist for anyone who would rather pin it, and now accepts
// several origins separated by commas.
const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
  .split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean);
const forwarded = (req: Request, header: string) =>
  req.headers[header]?.toString().split(',')[0]?.trim() || undefined;
const requestOrigin = (req: Request) => {
  const host = forwarded(req, 'x-forwarded-host') ?? req.headers.host;
  if (!host) return undefined;
  return `${forwarded(req, 'x-forwarded-proto') ?? (req.secure ? 'https' : 'http')}://${host}`;
};
// Left blank in a .env file this arrives as an empty string, which express would reject as an
// invalid IP range and take the whole API down with it — so blank means "unset".
const trustProxy = (value: string | undefined) =>
  !value ? 1 : /^\d+$/.test(value) ? Number(value)
    : value === 'true' ? true : value === 'false' ? false : value;
// Invitation-only unless told otherwise. An instance that anyone who finds the URL can sign up
// to is not a family's gift list any more. Read on each call rather than at import, so the
// tests can exercise both settings against one running server.
const openRegistration = () => /^(1|true|yes|on)$/i.test(process.env.OPEN_REGISTRATION ?? '');
// An empty database is the exception: someone has to be able to create the first account.
const openRegistrationAllowed = async () =>
  openRegistration() || !(await first('SELECT 1 FROM users LIMIT 1'));
const app = express();
app.disable('x-powered-by');
// Rate limits are counted per IP, and behind a proxy every request carries the proxy's address.
// Without this, one visitor fumbling their password spends the login budget of everyone else.
// The default counts a single hop — the web container — which stays correct when a further
// proxy sits in front of it, since each one appends to X-Forwarded-For.
app.set('trust proxy', trustProxy(process.env.TRUST_PROXY));
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  const own = requestOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', own ?? allowedOrigins[0] ?? '');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept-Language');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  const origin = req.headers.origin?.replace(/\/$/, '');
  if (!['GET', 'HEAD'].includes(req.method) && origin && origin !== own && !allowedOrigins.includes(origin)) {
    // Logged because the response cannot say it: knowing which origin the server expected is
    // exactly what turns an evening of guessing into a one-line fix.
    console.warn(`Origine refusée : reçue ${origin}, attendue ${own ?? '(hôte inconnu)'} ou ${allowedOrigins.join(', ') || '(aucune)'}`);
    next(new HttpError(403, 'Origine interdite')); return;
  }
  next();
});
const api = express.Router();
// Registered before the /api router so that container probes never consume the rate-limit
// budget. It touches the database, because an API that cannot query is not ready to serve.
app.get('/api/health', async (_req, res) => {
  try {
    await query('select 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
// Public, and registered before the /api router so the session middleware never sees it: the
// interface reads this before anyone can log in, to know whether an invitation code is required
// rather than letting someone fill in a form that was never going to be accepted.
app.get('/api/config', async (_req, res) => {
  res.json({ openRegistration: await openRegistrationAllowed() });
});
app.use('/api', api);
const rateLimitError = (_req: Request, _res: Response, next: NextFunction) => next(new HttpError(429, 'Trop de requêtes'));
api.use(rateLimit({ windowMs: 15 * 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitError }));
const strictLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitError });
// Previews get their own budget so retrying a stubborn link never locks anyone out of signing in.
const previewLimit = rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, handler: rateLimitError });
api.post('/auth/register', strictLimit, async (req, res) => {
  const data = z.object({
    firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
    email: z.email().toLowerCase(), password: z.string().min(12).max(128),
    birthDate: z.iso.date(), invitation: z.string().optional(),
  }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let householdId: string | undefined;
    let familyId: string | undefined;
    if (data.invitation) {
      // Either kind of code is accepted, because the person holding one has no way of telling
      // which they were given. A household code puts them in an existing home; a family code
      // gives them a home of their own, already attached to the family.
      const household = (await client.query<{household_id: string}>(`UPDATE invitations SET used_at=now()
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() AND (email IS NULL OR email=$2)
        RETURNING household_id`, [digest(data.invitation), data.email])).rows[0];
      if (household) householdId = household.household_id;
      else {
        const family = (await client.query<{family_id: string}>(`UPDATE family_invitations SET used_at=now()
          WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING family_id`,
        [digest(data.invitation)])).rows[0];
        if (!family) fail(403, 'Invitation invalide ou expirée');
        familyId = family.family_id;
      }
    } else {
      // The very first account of a fresh install can always be created, otherwise a closed
      // instance would have no way in at all. The lock makes that check trustworthy: without it
      // two simultaneous sign-ups would both find the table empty and both become an admin.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['pensa:open-registration']);
      if (!openRegistration() && (await client.query('SELECT 1 FROM users LIMIT 1')).rowCount)
        fail(403, 'Inscription sur invitation uniquement');
    }
    if (!householdId)
      householdId = (await client.query<{id:string}>('INSERT INTO households(name) VALUES($1) RETURNING id', [`Foyer de ${data.firstName}`])).rows[0].id;
    const result = await client.query<Person>(`INSERT INTO users(household_id,first_name,last_name,email,password_hash,birth_date,household_admin)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [householdId, data.firstName, data.lastName, data.email, await hash(data.password, 12), data.birthDate, !data.invitation || !!familyId]);
    // Same transaction as the account and the household: a failure here must not leave someone
    // holding a spent family code and a home that is attached to nothing.
    if (familyId) await client.query('INSERT INTO memberships VALUES($1,$2)', [familyId, householdId]);
    const value = token();
    await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'14 days\')',
      [digest(value), result.rows[0].id]);
    await client.query('COMMIT');
    sessionCookie(res, value, req);
    res.status(201).json(privatePerson(result.rows[0]));
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.post('/auth/login', strictLimit, async (req, res) => {
  const data = z.object({ email: z.email(), password: z.string() }).parse(req.body);
  const record = await first<Person & { password_hash: string }>('SELECT * FROM users WHERE email=$1', [data.email.toLowerCase()]);
  if (!record || !await compare(data.password, record.password_hash)) fail(401, 'Identifiants invalides');
  const value = token();
  await query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'14 days\')', [digest(value), record.id]);
  sessionCookie(res, value, req);
  res.json(privatePerson(record));
});
api.post('/auth/logout', async (req, res) => {
  const value = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  if (value) await query('DELETE FROM sessions WHERE token_hash=$1', [digest(value)]);
  res.clearCookie('session', { path: '/' }); res.json({ ok: true });
});
api.use(async (req, _res, next) => {
  try {
    const value = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const record = value ? await first<Person>(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now()`, [digest(value)]) : undefined;
    if (!record) fail(401, 'Connexion requise');
    (req as AuthRequest).person = record;
    next();
  } catch (e) { next(e); }
});
api.get('/auth/me', (req, res) => res.json(privatePerson(person(req))));
api.get('/profile', (req, res) => res.json(privatePerson(person(req))));
api.patch('/profile', async (req, res) => {
  const data = z.object({ firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
    avatar: z.url().nullable().optional(), nameDay: z.string().regex(/^\d{2}-\d{2}$/).nullable().optional() }).parse(req.body);
  if (data.nameDay) {
    const date = new Date(`2024-${data.nameDay}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(5, 10) !== data.nameDay)
      fail(400, 'Date de fête invalide');
  }
  const p = await first<Person>('UPDATE users SET first_name=$1,last_name=$2,avatar=$3,name_day=$4 WHERE id=$5 RETURNING *',
    [data.firstName, data.lastName, data.avatar === undefined ? person(req).avatar : data.avatar,
      data.nameDay === undefined ? person(req).name_day : data.nameDay, person(req).id]);
  res.json(privatePerson(p));
});
api.get('/users', async (req, res) => {
  const rows = await query<Person>(`SELECT DISTINCT u.id,u.first_name,u.last_name,u.avatar,u.birth_date FROM users u
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 ORDER BY u.first_name`, [person(req).household_id]);
  res.json(rows.map(publicPerson));
});
api.get('/households', async (req, res) => {
  const rows = await query<{id:string;name:string}>(`SELECT DISTINCT h.id,h.name FROM households h LEFT JOIN memberships m ON m.household_id=h.id
    LEFT JOIN memberships mine ON mine.family_id=m.family_id AND mine.household_id=$1
    WHERE h.id=$1 OR mine.household_id IS NOT NULL ORDER BY h.name`, [person(req).household_id]);
  res.json(await Promise.all(rows.map(async h => ({ ...h, mine: h.id === person(req).household_id, members: await householdMembers(h.id) }))));
});
api.get('/households/mine', async (req, res) => {
  const h = await first<{id:string;name:string}>('SELECT id,name FROM households WHERE id=$1', [person(req).household_id]);
  res.json({ ...h, members: await householdMembers(h.id) });
});
api.patch('/households/:id/members/:userId', async (req, res) => {
  const id = uuid.parse(req.params.id), userId = uuid.parse(req.params.userId);
  const { admin } = z.object({ admin: z.boolean() }).parse(req.body);
  if (id !== person(req).household_id) fail(403, 'Administration du foyer requise');
  await requireHouseholdAdmin(person(req));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const members = (await client.query<{id:string;household_admin:boolean}>('SELECT id,household_admin FROM users WHERE household_id=$1 FOR UPDATE', [id])).rows;
    if (!members.some(m => m.id === userId)) fail(404, 'Membre du foyer introuvable');
    if (!admin && !members.some(m => m.id !== userId && m.household_admin)) fail(409, 'Un foyer doit conserver un administrateur');
    await client.query('UPDATE users SET household_admin=$1 WHERE id=$2', [admin, userId]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  res.json({ members: await householdMembers(id) });
});
api.patch('/households/:id', async (req, res) => {
  const id = uuid.parse(req.params.id), data = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
  const row = await first('UPDATE households SET name=$1 WHERE id=$2 AND id=$3 AND EXISTS(SELECT 1 FROM users WHERE id=$4 AND household_admin=true) RETURNING *',
    [data.name, id, person(req).household_id, person(req).id]);
  if (!row) fail(403, 'Administration du foyer requise');
  res.json(row);
});
api.post('/households/:id/invitations', async (req, res) => {
  const id = uuid.parse(req.params.id);
  if (id !== person(req).household_id || !await first('SELECT 1 FROM users WHERE id=$1 AND household_admin', [person(req).id]))
    fail(403, 'Administration du foyer requise');
  const data = z.object({ email: z.email().optional() }).parse(req.body);
  const value = token();
  await query('INSERT INTO invitations(token_hash,household_id,email,expires_at) VALUES($1,$2,$3,now()+interval \'7 days\')',
    [digest(value), id, data.email?.toLowerCase() ?? null]);
  res.status(201).json({ code: value, expiresInDays: 7 });
});
api.get('/families', async (req, res) => {
  const rows = await query<{id:string;name:string;admin:boolean}>(`SELECT f.*, EXISTS(SELECT 1 FROM family_admins a WHERE a.family_id=f.id AND a.user_id=$2) AS admin
    FROM families f JOIN memberships m ON m.family_id=f.id WHERE m.household_id=$1 ORDER BY f.name`,
    [person(req).household_id, person(req).id]);
  res.json(await Promise.all(rows.map(async f => {
    const admins = new Set((await query<{user_id:string}>('SELECT user_id FROM family_admins WHERE family_id=$1', [f.id])).map(a => a.user_id));
    const households = await query<{id:string;name:string}>(`SELECT h.id,h.name FROM households h JOIN memberships m ON m.household_id=h.id
      WHERE m.family_id=$1 ORDER BY h.name`, [f.id]);
    return {
      ...f,
      members: (await query<Person>(`SELECT u.* FROM users u JOIN memberships m ON m.household_id=u.household_id
        WHERE m.family_id=$1 ORDER BY u.first_name`, [f.id])).map(p => ({ ...publicPerson(p), familyAdmin: admins.has(p.id) })),
      households: await Promise.all(households.map(async h => ({ ...h,
        members: (await householdMembers(h.id)).map(m => ({ ...m, familyAdmin: admins.has(m.id) })) }))),
    };
  })));
});
api.post('/families', async (req, res) => {
  await requireHouseholdAdmin(person(req));
  const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const family = (await client.query<{ id: string; name: string }>('INSERT INTO families(name) VALUES($1) RETURNING *', [name])).rows[0];
    await client.query('INSERT INTO memberships VALUES($1,$2)', [family.id, person(req).household_id]);
    await client.query('INSERT INTO family_admins VALUES($1,$2)', [family.id, person(req).id]);
    await createDefaultOccasions(client, family.id);    await client.query('COMMIT'); res.status(201).json(family);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.patch('/families/:id', async (req, res) => {
  const id = uuid.parse(req.params.id); await ownFamily(person(req), id);
  const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
  res.json(await first('UPDATE families SET name=$1 WHERE id=$2 RETURNING *', [name, id]));
});
api.post('/families/:id/invitations', async (req, res) => {
  const id = uuid.parse(req.params.id); await ownFamily(person(req), id);
  const value = token();
  await query('INSERT INTO family_invitations(token_hash,family_id,expires_at) VALUES($1,$2,now()+interval \'7 days\')',
    [digest(value), id]);
  res.status(201).json({ code: value, expiresInDays: 7 });
});
api.post('/families/join', async (req, res) => {
  await requireHouseholdAdmin(person(req));
  const { code } = z.object({ code: z.string().min(1).max(128) }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invite = (await client.query<{family_id:string}>(`UPDATE family_invitations SET used_at=now()
      WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING family_id`, [digest(code)])).rows[0];
    if (!invite) fail(403, 'Invitation invalide ou expirée');
    if ((await client.query('SELECT 1 FROM memberships WHERE family_id=$1 AND household_id=$2',
      [invite.family_id, person(req).household_id])).rowCount) fail(409, 'Foyer déjà membre');
    await client.query('INSERT INTO memberships VALUES($1,$2)', [invite.family_id, person(req).household_id]);
    await client.query('COMMIT');
    res.status(201).json({ familyId: invite.family_id, householdId: person(req).household_id });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.delete('/families/:id/households/:householdId', async (req, res) => {
  const id = uuid.parse(req.params.id), householdId = uuid.parse(req.params.householdId);
  await ownFamily(person(req), id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM families WHERE id=$1 FOR UPDATE', [id]);
    const count = (await client.query<{count:string}>('SELECT count(*) FROM memberships WHERE family_id=$1', [id])).rows[0];
    if (Number(count.count) <= 1) fail(409, 'Une famille doit conserver un foyer');
    const active = await client.query(`SELECT 1 FROM reservations r JOIN wishes w ON w.id=r.wish_id
      JOIN users owner ON owner.id=w.owner_id JOIN users creator ON creator.id=r.creator_id
      JOIN memberships scope ON scope.household_id=owner.household_id AND scope.family_id=$1
      WHERE r.cancelled_at IS NULL AND r.status!='gifted' AND
      (owner.household_id=$2 OR creator.household_id=$2 OR EXISTS(
        SELECT 1 FROM participants p JOIN users member ON member.id=p.user_id
        WHERE p.reservation_id=r.id AND member.household_id=$2)) LIMIT 1`, [id, householdId]);
    if (active.rowCount) fail(409, 'Terminer les réservations avant de retirer ce foyer');
    await client.query('DELETE FROM family_admins WHERE family_id=$1 AND user_id IN(SELECT id FROM users WHERE household_id=$2)', [id, householdId]);
    const admins = (await client.query<{count:string}>('SELECT count(*) FROM family_admins WHERE family_id=$1', [id])).rows[0];
    if (!Number(admins.count)) fail(409, 'Une famille doit conserver un administrateur');
    await client.query('DELETE FROM memberships WHERE family_id=$1 AND household_id=$2', [id, householdId]);
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.post('/families/:id/admins', async (req, res) => {
  const id = uuid.parse(req.params.id); await ownFamily(person(req), id);
  const { userId } = z.object({ userId: uuid }).parse(req.body);
  if (!await first('SELECT 1 FROM users u JOIN memberships m ON m.household_id=u.household_id WHERE u.id=$1 AND m.family_id=$2', [userId, id]))
    fail(403, 'Utilisateur hors famille');
  await query('INSERT INTO family_admins VALUES($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
  res.status(201).json({ userId });
});
const occasionData = z.object({ name: z.string().trim().min(1).max(100), kind: z.enum(['fixed', 'birthday', 'name_day']),
  month: z.number().int().min(1).max(12).nullable().optional(), day: z.number().int().min(1).max(31).nullable().optional() }).refine(v =>
  v.kind === 'fixed' ? !!v.month && !!v.day && !Number.isNaN(new Date(2024, v.month - 1, v.day).getTime()) &&
    new Date(2024, v.month - 1, v.day).getMonth() === v.month - 1 : !v.month && !v.day,
  'Date invalide');
const occasionMonthDay = (r: { kind: string; month: number | null; day: number | null }, recipient?: Person | null) => {
  const month = r.kind === 'birthday' ? Number(recipient && birthday(recipient)?.slice(5, 7)) :
    r.kind === 'name_day' ? Number(recipient?.name_day?.slice(0, 2)) : r.month;
  const day = r.kind === 'birthday' ? Number(recipient && birthday(recipient)?.slice(8, 10)) :
    r.kind === 'name_day' ? Number(recipient?.name_day?.slice(3, 5)) : r.day;
  return { month: month || null, day: day || null };
};
const upcoming = async (viewer: Person, recipientId: string) => {
  if (!await visible(viewer.id, recipientId)) fail(403, 'Personne inaccessible');
  const allRows = await query<{ id: string; name: string; kind: string; month: number | null; day: number | null }>(`SELECT DISTINCT o.* FROM occasions o JOIN memberships m ON m.family_id=o.family_id
    JOIN users recipient ON recipient.household_id=m.household_id
    JOIN memberships mine ON mine.family_id=o.family_id AND mine.household_id=$2
    WHERE recipient.id=$1 ORDER BY o.id`, [recipientId, viewer.household_id]);
  const seen = new Set<string>();
  const rows = allRows.filter(r => {
    const key = JSON.stringify([r.name, r.kind, r.month, r.day]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const recipient = await first<Person>('SELECT * FROM users WHERE id=$1', [recipientId]);
  const now = new Date();
  const results = rows.map(r => {
    const { month, day } = occasionMonthDay(r, recipient);
    if (!month || !day) return { ...r, nextDate: null };
    let year = now.getUTCFullYear();
    let candidate = new Date(Date.UTC(year, month - 1, day));
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    while (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day || candidate < today) {
      year++; candidate = new Date(Date.UTC(year, month - 1, day));
    }
    return { ...r, nextDate: candidate.toISOString().slice(0, 10) };
  }).sort((a, b) => (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999'));
  return results;
};
api.get('/occasions', async (req, res) => {
  res.json(await upcoming(person(req), uuid.parse(req.query.recipientId ?? person(req).id)));
});
api.post('/families/:id/occasions', async (req, res) => {
  const id = uuid.parse(req.params.id); await ownFamily(person(req), id);
  const d = occasionData.parse(req.body);
  res.status(201).json(await first('INSERT INTO occasions(family_id,name,kind,month,day) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [id, d.name, d.kind, d.month ?? null, d.day ?? null]));
});
api.patch('/occasions/:id', async (req, res) => {
  const id = uuid.parse(req.params.id), d = occasionData.parse(req.body);
  const row = await first<{family_id:string}>('SELECT family_id FROM occasions WHERE id=$1', [id]);
  if (!row) fail(404, 'Occasion introuvable');
  await ownFamily(person(req), row.family_id);
  res.json(await first('UPDATE occasions SET name=$1,kind=$2,month=$3,day=$4 WHERE id=$5 RETURNING *',
    [d.name, d.kind, d.month ?? null, d.day ?? null, id]));
});
api.delete('/occasions/:id', async (req, res) => {
  const id = uuid.parse(req.params.id);
  const row = await first<{family_id:string}>('SELECT family_id FROM occasions WHERE id=$1', [id]);
  if (!row) fail(404, 'Occasion introuvable');
  await ownFamily(person(req), row.family_id);
  if (await first('SELECT 1 FROM reservation_occasions WHERE occasion_id=$1 LIMIT 1', [id]))
    fail(409, 'Occasion utilisée dans une réservation');
  await query('DELETE FROM occasions WHERE id=$1', [id]); res.json({ ok: true });
});
type Wish = { id: string; owner_id: string; title: string; description: string | null; url: string | null; image: string | null; price: string | null; tags: string[]; position: number; deleted_at: Date | null; gifted_at: Date | null; off_list: boolean; created_by: string | null };
const wishAccess = async (id: string, viewer: string) => {
  const wish = await first<Wish>('SELECT * FROM wishes WHERE id=$1', [id]);
  if (!wish || wish.off_list || !await visible(viewer, wish.owner_id)) fail(404, 'Souhait introuvable');
  return wish;
};
const wishFilters = z.strictObject({
  tag: z.string().trim().min(1).max(40).optional(),
  availability: z.enum(['available', 'reserved']).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
});
const reservationView = async (wish: Wish, viewer: string) => {
  const result: Record<string, unknown> = {
    id: wish.id, ownerId: wish.owner_id, title: wish.title, description: wish.description,
    url: wish.url, image: wish.image, price: wish.price, tags: wish.tags, position: wish.position,
  };
  if (wish.owner_id !== viewer) {
    const r = await first<{id:string; creator_id:string; open_to_contributions:boolean}>(`SELECT id,creator_id,open_to_contributions FROM reservations
      WHERE wish_id=$1 AND cancelled_at IS NULL AND status!='gifted'`, [wish.id]);
    if (r) {
      const creator = await first<Person>('SELECT * FROM users WHERE id=$1', [r.creator_id]);
      const people = await query<Person>('SELECT u.* FROM users u JOIN participants p ON p.user_id=u.id WHERE p.reservation_id=$1', [r.id]);
      result.reservation = { id: r.id, creator: publicPerson(creator), participants: people.map(publicPerson),
        openToContributions: r.open_to_contributions };
    }
  }
  return result;
};
const listWishes = async (viewer: string, owner: string, filters: z.infer<typeof wishFilters> = {}) => {
  if (!await visible(viewer, owner)) fail(403, 'Personne inaccessible');
  const rows = await query<Wish>(`SELECT * FROM wishes WHERE owner_id=$1 AND deleted_at IS NULL AND gifted_at IS NULL AND NOT off_list
    ORDER BY position,created_at`, [owner]);
  const result = await Promise.all(rows.map(row => reservationView(row, viewer)));
  return result.filter(row => {
    if (filters.tag && !(row.tags as string[]).includes(String(filters.tag))) return false;
    if (filters.minPrice !== undefined && (row.price === null || Number(row.price) < filters.minPrice)) return false;
    if (filters.maxPrice !== undefined && (row.price === null || Number(row.price) > filters.maxPrice)) return false;
    if (filters.availability && viewer !== owner && (filters.availability === 'reserved') !== !!row.reservation) return false;
    return true;
  });
};
api.get('/wishes', async (req, res) => res.json(await listWishes(person(req).id, person(req).id, wishFilters.parse(req.query))));
api.get('/users/:id/wishes', async (req, res) => res.json(await listWishes(person(req).id, uuid.parse(req.params.id), wishFilters.parse(req.query))));
api.get('/wishes/:id', async (req, res) => {
  const wish = await wishAccess(uuid.parse(req.params.id), person(req).id);
  if (wish.deleted_at || wish.gifted_at) fail(404, 'Souhait introuvable');
  res.json(await reservationView(wish, person(req).id));
});
api.post('/wishes/preview', previewLimit, async (req, res) => {
  const { url } = z.object({ url: z.url().max(2048) }).parse(req.body);
  try { res.json(await preview(url)); } catch (e) {
    if (e instanceof Error) fail(400, previewErrors.has(e.message) ? e.message : 'Page inaccessible');
    throw e;
  }
});
api.post('/wishes', async (req, res) => {
  const d = z.object({ title: z.string().trim().min(1).max(200), image: httpUrl.or(z.literal('')).nullish(),
    url: z.url().max(2048), description: z.string().max(5000).nullish(),
    price: z.coerce.number().min(0).max(99999999).nullable().optional(), tags: tags.default([]) }).parse(req.body);
  if (!/^https?:\/\//.test(d.url)) fail(400, 'URL HTTP(S) requise');
  const row = await first<Wish>(`INSERT INTO wishes(owner_id,title,image,url,description,price,tags,position)
    VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT count(*) FROM wishes WHERE owner_id=$1 AND NOT off_list)) RETURNING *`,
    [person(req).id, d.title, d.image || null, d.url, d.description ?? null, d.price ?? null, d.tags]);
  res.status(201).json(await reservationView(row, person(req).id));
});
api.patch('/wishes/order', async (req, res) => {
  const { ids } = z.object({ ids: z.array(uuid).max(1000) }).parse(req.body);
  if (new Set(ids).size !== ids.length) fail(400, 'Ordre invalide');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = (await client.query<{id:string}>('SELECT id FROM wishes WHERE owner_id=$1 AND deleted_at IS NULL AND gifted_at IS NULL AND NOT off_list FOR UPDATE', [person(req).id])).rows;
    if (rows.length !== ids.length || rows.some(r => !ids.includes(r.id))) fail(400, 'Liste incomplète');
    for (let i = 0; i < ids.length; i++) await client.query('UPDATE wishes SET position=$1 WHERE id=$2', [i, ids[i]]);
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.patch('/wishes/:id', async (req, res) => {
  const id = uuid.parse(req.params.id);
  const d = z.strictObject({ tags }).parse(req.body);
  const row = await first<Wish>('UPDATE wishes SET tags=$1 WHERE id=$2 AND owner_id=$3 AND deleted_at IS NULL AND gifted_at IS NULL AND NOT off_list RETURNING *',
    [d.tags, id, person(req).id]);
  if (!row) fail(404, 'Souhait introuvable');
  res.json(await reservationView(row, person(req).id));
});
api.delete('/wishes/:id', async (req, res) => {
  const row = await first('UPDATE wishes SET deleted_at=now() WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL AND gifted_at IS NULL AND NOT off_list RETURNING id',
    [uuid.parse(req.params.id), person(req).id]);
  if (!row) fail(404, 'Souhait introuvable');
  res.json({ ok: true });
});

type Reservation = { id: string; wish_id: string; creator_id: string; status: string; open_to_contributions: boolean; cancelled_at: Date | null; created_at: Date; owner_id: string; deleted_at: Date | null; gifted_at: Date | null; off_list?: boolean };
const getReservation = async (id: string, viewer: string) => {
  const row = await first<Reservation>(`SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r JOIN wishes w ON w.id=r.wish_id WHERE r.id=$1`, [id]);
  if (!row || row.owner_id === viewer || !await visible(viewer, row.owner_id)) fail(404, 'Réservation introuvable');
  return row;
};
const reservationDetails = async (r: Reservation, viewer: string) => {
  const participantsRows = await query<Person>('SELECT u.* FROM users u JOIN participants p ON p.user_id=u.id WHERE p.reservation_id=$1', [r.id]);
  const creator = await first<Person>('SELECT * FROM users WHERE id=$1', [r.creator_id]);
  const occasionsRows = await query<{ id: string; name: string; kind: string; month: number | null; day: number | null; year: number }>(`SELECT o.id,o.name,o.kind,o.month,o.day,ro.year FROM reservation_occasions ro
    JOIN occasions o ON o.id=ro.occasion_id WHERE ro.reservation_id=$1`, [r.id]);
  const wish = await first<Wish>('SELECT * FROM wishes WHERE id=$1', [r.wish_id]);
  const recipient = await first<Person>('SELECT * FROM users WHERE id=$1', [r.owner_id]);
  const occasions = occasionsRows.map(o => ({ o, ...occasionMonthDay(o, recipient) }))
    .sort((a, b) => a.o.year - b.o.year || (a.month ?? 13) - (b.month ?? 13) || (a.day ?? 32) - (b.day ?? 32) || a.o.name.localeCompare(b.o.name))
    .map(({ o }) => ({ id: o.id, name: o.name, kind: o.kind, year: o.year }));
  return { id: r.id, wishId: r.wish_id, offList: !!wish?.off_list,
    wish: wish && { id: wish.id, title: wish.title, image: wish.image, price: wish.price,
      ...(wish.off_list ? { description: wish.description, url: wish.url } : {}) },
    recipient: publicPerson(recipient), creator: publicPerson(creator), participants: participantsRows.map(publicPerson),
    openToContributions: r.open_to_contributions, status: r.creator_id === viewer || participantsRows.some(p => p.id === viewer) ? r.status : undefined,
    occasions, wishDeleted: !!r.deleted_at, cancelled: !!r.cancelled_at };
};
const occasionInput = z.array(z.object({ id: uuid, year: z.number().int().min(2000).max(2200) })).min(1).max(30);
const setOccasions = async (client: import('pg').PoolClient, reservationId: string, ownerId: string,
  buyerHousehold: string, selections: z.infer<typeof occasionInput>) => {
  const ids = [...new Set(selections.map(s => s.id))];
  const allowed = (await client.query<{id:string}>(`SELECT DISTINCT o.id FROM occasions o JOIN memberships recipient ON recipient.family_id=o.family_id
    JOIN users u ON u.household_id=recipient.household_id JOIN memberships buyer ON buyer.family_id=o.family_id AND buyer.household_id=$3
    WHERE u.id=$1 AND o.id=ANY($2::uuid[])`, [ownerId, ids, buyerHousehold])).rows;
  if (allowed.length !== ids.length) fail(403, 'Occasion hors des familles communes');
  await client.query('DELETE FROM reservation_occasions WHERE reservation_id=$1', [reservationId]);
  for (const selection of selections)
    await client.query('INSERT INTO reservation_occasions VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [reservationId, selection.id, selection.year]);
};
const setParticipants = async (client: import('pg').PoolClient, reservationId: string, ownerId: string,
  creatorId: string, ids: string[]) => {
  if (ids.includes(ownerId)) fail(403, 'Le bénéficiaire ne peut pas participer');
  const people = [...new Set([...ids, creatorId])];
  const valid = (await client.query<{id:string}>(`SELECT DISTINCT u.id FROM users u JOIN memberships m ON m.household_id=u.household_id
    JOIN users recipient ON recipient.id=$1 JOIN memberships rm ON rm.household_id=recipient.household_id AND rm.family_id=m.family_id
    WHERE u.id=ANY($2::uuid[])`, [ownerId, people])).rows;
  if (valid.length !== people.length) fail(403, 'Participant hors des familles du bénéficiaire');
  await client.query('DELETE FROM participants WHERE reservation_id=$1', [reservationId]);
  for (const userId of people) await client.query('INSERT INTO participants VALUES($1,$2)', [reservationId, userId]);
};
api.post('/reservations', async (req, res) => {
  const d = z.object({ wishId: uuid, occasionIds: occasionInput, participantIds: z.array(uuid).default([]),
    openToContributions: z.boolean().default(false) }).parse(req.body);
  const actor = person(req);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wish = (await client.query<Wish>('SELECT * FROM wishes WHERE id=$1 FOR UPDATE', [d.wishId])).rows[0];
    if (!wish || wish.deleted_at || wish.gifted_at || wish.off_list) fail(404, 'Souhait indisponible');
    if (wish.owner_id === actor.id) fail(403, 'Impossible de réserver son propre souhait');
    const common = await client.query(`SELECT f.id FROM families f JOIN memberships mine ON mine.family_id=f.id
      JOIN users buyer ON buyer.household_id=mine.household_id
      JOIN users recipient ON recipient.id=$2 JOIN memberships theirs
        ON theirs.family_id=f.id AND theirs.household_id=recipient.household_id
      WHERE buyer.id=$1 ORDER BY f.id FOR SHARE OF f`, [actor.id, wish.owner_id]);
    if (!common.rowCount) fail(403, 'Personne inaccessible');
    if ((await client.query('SELECT 1 FROM reservations WHERE wish_id=$1 AND cancelled_at IS NULL', [wish.id])).rowCount)
      fail(409, 'Souhait déjà réservé');
    const r = (await client.query<Reservation>(`INSERT INTO reservations(wish_id,creator_id,open_to_contributions)
      VALUES($1,$2,$3) RETURNING *`, [wish.id, actor.id, d.openToContributions])).rows[0];
    await setOccasions(client, r.id, wish.owner_id, actor.household_id, d.occasionIds);
    await setParticipants(client, r.id, wish.owner_id, actor.id, d.participantIds);
    await client.query('COMMIT');
    res.status(201).json(await reservationDetails({ ...r, owner_id: wish.owner_id, deleted_at: null, gifted_at: null }, actor.id));
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
const httpUrl = z.url().max(2048).refine(v => /^https?:\/\//.test(v), 'URL HTTP(S) requise');
const giftFields = {
  title: z.string().trim().min(1).max(200), description: z.string().max(5000).nullish(),
  price: z.coerce.number().min(0).max(99999999).nullish(), url: httpUrl.nullish(), image: httpUrl.nullish(),
};
api.post('/reservations/off-list', async (req, res) => {
  const d = z.object({ recipientId: uuid, ...giftFields, occasionIds: occasionInput,
    participantIds: z.array(uuid).default([]), openToContributions: z.boolean().default(false) }).parse(req.body);
  const actor = person(req);
  if (d.recipientId === actor.id) fail(403, 'Impossible de prévoir un cadeau pour soi-même');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const common = await client.query(`SELECT f.id FROM families f JOIN memberships mine ON mine.family_id=f.id
      JOIN users buyer ON buyer.household_id=mine.household_id
      JOIN users recipient ON recipient.id=$2 JOIN memberships theirs
        ON theirs.family_id=f.id AND theirs.household_id=recipient.household_id
      WHERE buyer.id=$1 ORDER BY f.id FOR SHARE OF f`, [actor.id, d.recipientId]);
    if (!common.rowCount) fail(403, 'Personne inaccessible');
    const wish = (await client.query<Wish>(`INSERT INTO wishes(owner_id,title,description,price,url,image,off_list,created_by)
      VALUES($1,$2,$3,$4,$5,$6,true,$7) RETURNING *`,
      [d.recipientId, d.title, d.description ?? null, d.price ?? null, d.url ?? null, d.image ?? null, actor.id])).rows[0];
    const r = (await client.query<Reservation>(`INSERT INTO reservations(wish_id,creator_id,open_to_contributions)
      VALUES($1,$2,$3) RETURNING *`, [wish.id, actor.id, d.openToContributions])).rows[0];
    await setOccasions(client, r.id, d.recipientId, actor.household_id, d.occasionIds);
    await setParticipants(client, r.id, d.recipientId, actor.id, d.participantIds);
    await client.query('COMMIT');
    res.status(201).json(await reservationDetails({ ...r, owner_id: d.recipientId, deleted_at: null, gifted_at: null, off_list: true }, actor.id));
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
const offListVisibility = `w.off_list AND r.cancelled_at IS NULL AND r.status!='gifted'`;
const withRequestStatus = async (r: Reservation, viewer: string) => ({
  ...await reservationDetails(r, viewer),
  requestStatus: (await first<{status:string}>('SELECT status FROM requests WHERE reservation_id=$1 AND user_id=$2', [r.id, viewer]))?.status ?? null,
});
api.get('/users/:id/off-list', async (req, res) => {
  const owner = uuid.parse(req.params.id), viewer = person(req).id;
  if (owner === viewer) { res.json([]); return; }
  if (!await visible(viewer, owner)) fail(403, 'Personne inaccessible');
  const rows = await query<Reservation>(`SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r
    JOIN wishes w ON w.id=r.wish_id WHERE w.owner_id=$1 AND ${offListVisibility}
    AND (r.open_to_contributions OR r.creator_id=$2 OR EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$2))
    ORDER BY r.created_at`, [owner, viewer]);
  res.json(await Promise.all(rows.map(r => withRequestStatus(r, viewer))));
});
api.get('/reservations', async (req, res) => {
  const rows = await query<Reservation>(`SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r
    JOIN wishes w ON w.id=r.wish_id WHERE w.owner_id<>$1 AND
    (r.creator_id=$1 OR EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$1))
    AND EXISTS(SELECT 1 FROM users viewer JOIN memberships mine ON mine.household_id=viewer.household_id
      JOIN users recipient ON recipient.id=w.owner_id JOIN memberships theirs
        ON theirs.household_id=recipient.household_id AND theirs.family_id=mine.family_id
      WHERE viewer.id=$1)
    ORDER BY r.created_at DESC`, [person(req).id]);
  res.json(await Promise.all(rows.map(row => reservationDetails(row, person(req).id))));
});
api.get('/reservations/:id', async (req, res) => {
  const r = await getReservation(uuid.parse(req.params.id), person(req).id);
  res.json(await reservationDetails(r, person(req).id));
});
api.patch('/reservations/:id', async (req, res) => {
  const id = uuid.parse(req.params.id);
  const d = z.strictObject({ occasionIds: occasionInput.optional(), participantIds: z.array(uuid).optional(),
    openToContributions: z.boolean().optional(), status: z.enum(['reserved', 'purchased', 'wrapped', 'gifted']).optional(),
    gift: z.strictObject(giftFields).optional() }).parse(req.body);
  const actor = person(req);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = (await client.query<Reservation>(`SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r
      JOIN wishes w ON w.id=r.wish_id WHERE r.id=$1 FOR UPDATE OF r,w`, [id])).rows[0];
    if (!r || r.owner_id === actor.id) fail(404, 'Réservation introuvable');
    if (r.creator_id !== actor.id) fail(403, 'Créateur requis');
    if (r.cancelled_at || r.status === 'gifted') fail(409, 'Réservation terminée');
    if (r.deleted_at && d.status === 'gifted') fail(409, 'Souhait supprimé');
    if (d.status && d.status !== r.status) {
      const moves: Record<string, string[]> = {
        reserved: ['purchased'], purchased: ['reserved', 'wrapped'], wrapped: ['purchased', 'gifted'],
      };
      if (!moves[r.status]?.includes(d.status)) fail(409, 'Transition de statut interdite');
    }
    if (d.occasionIds) await setOccasions(client, id, r.owner_id, actor.household_id, d.occasionIds);
    if (d.participantIds) await setParticipants(client, id, r.owner_id, actor.id, d.participantIds);
    if (d.gift) {
      if (!r.off_list) fail(409, 'Seul un cadeau hors liste peut être modifié');
      await client.query('UPDATE wishes SET title=$1,description=$2,price=$3,url=$4,image=$5 WHERE id=$6',
        [d.gift.title, d.gift.description ?? null, d.gift.price ?? null, d.gift.url ?? null, d.gift.image ?? null, r.wish_id]);
    }
    await client.query('UPDATE reservations SET status=COALESCE($1,status),open_to_contributions=COALESCE($2,open_to_contributions) WHERE id=$3',
      [d.status ?? null, d.openToContributions ?? null, id]);
    if (d.status === 'gifted') {
      const wish = (await client.query<Wish>('UPDATE wishes SET gifted_at=now() WHERE id=$1 RETURNING *', [r.wish_id])).rows[0];
      const people = (await client.query('SELECT u.id,u.first_name,u.last_name FROM users u JOIN participants p ON p.user_id=u.id WHERE p.reservation_id=$1', [id])).rows;
      const recipient = (await client.query('SELECT id,first_name,last_name,birth_date FROM users WHERE id=$1', [r.owner_id])).rows[0];
      const creator = people.find(p => p.id === r.creator_id);
      const occ = (await client.query('SELECT o.name,o.kind,ro.year FROM reservation_occasions ro JOIN occasions o ON o.id=ro.occasion_id WHERE ro.reservation_id=$1 ORDER BY ro.year', [id])).rows;
      await client.query('INSERT INTO history(reservation_id,recipient_id,snapshot) VALUES($1,$2,$3)',
        [id, r.owner_id, JSON.stringify({ ...wish, recipientId: r.owner_id, creatorId: r.creator_id,
          recipient, creator, participants: people, occasions: occ, reservedAt: r.created_at, giftedAt: wish.gifted_at })]);
    }
    await client.query('COMMIT');
    res.json(await reservationDetails({ ...r, status: d.status ?? r.status }, actor.id));
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.delete('/reservations/:id', async (req, res) => {
  const r = await getReservation(uuid.parse(req.params.id), person(req).id);
  if (r.creator_id !== person(req).id) fail(403, 'Créateur requis');
  const row = await first('UPDATE reservations SET cancelled_at=now() WHERE id=$1 AND creator_id=$2 AND cancelled_at IS NULL AND status!=\'gifted\' RETURNING id',
    [r.id, person(req).id]);
  if (!row) fail(409, 'Réservation terminée');
  if (r.off_list) await query('UPDATE wishes SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL', [r.wish_id]);
  res.json({ ok: true });
});
api.post('/reservations/:id/requests', async (req, res) => {
  const r = await getReservation(uuid.parse(req.params.id), person(req).id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = (await client.query<Reservation>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [r.id])).rows[0];
    if (current.cancelled_at || current.status === 'gifted' || !current.open_to_contributions ||
      current.creator_id === person(req).id) fail(409, 'Participation fermée');
    if ((await client.query('SELECT 1 FROM participants WHERE reservation_id=$1 AND user_id=$2', [r.id, person(req).id])).rowCount)
      fail(409, 'Déjà participant');
    const row = (await client.query(`INSERT INTO requests(reservation_id,user_id) VALUES($1,$2)
      ON CONFLICT(reservation_id,user_id) DO UPDATE SET status='pending' RETURNING *`, [r.id, person(req).id])).rows[0];
    await client.query('COMMIT');
    res.status(201).json(row);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.get('/reservations/:id/requests', async (req, res) => {
  const r = await getReservation(uuid.parse(req.params.id), person(req).id);
  if (r.creator_id !== person(req).id) fail(403, 'Créateur requis');
  res.json(await query(`SELECT q.id,q.status,u.id AS "userId",u.first_name AS "firstName",u.last_name AS "lastName"
    FROM requests q JOIN users u ON u.id=q.user_id WHERE q.reservation_id=$1`, [r.id]));
});
api.patch('/reservations/:id/requests/:requestId', async (req, res) => {
  const r = await getReservation(uuid.parse(req.params.id), person(req).id);
  if (r.creator_id !== person(req).id) fail(403, 'Créateur requis');
  const { status } = z.object({ status: z.enum(['accepted', 'refused']) }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = (await client.query<Reservation>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [r.id])).rows[0];
    if (current.cancelled_at || current.status === 'gifted') fail(409, 'Réservation terminée');
    const q = (await client.query<{user_id:string}>(`UPDATE requests SET status=$1 WHERE id=$2 AND reservation_id=$3 AND status='pending' RETURNING user_id`,
      [status, uuid.parse(req.params.requestId), r.id])).rows[0];
    if (!q) fail(404, 'Demande introuvable');
    if (status === 'accepted') {
      const access = await client.query(`SELECT f.id FROM families f
        JOIN memberships requester ON requester.family_id=f.id
        JOIN users applicant ON applicant.household_id=requester.household_id AND applicant.id=$1
        JOIN memberships recipient ON recipient.family_id=f.id
        JOIN users beneficiary ON beneficiary.household_id=recipient.household_id AND beneficiary.id=$2
        FOR SHARE OF f`, [q.user_id, r.owner_id]);
      if (!access.rowCount) fail(403, 'Participant hors des familles du bénéficiaire');
      await client.query('INSERT INTO participants VALUES($1,$2) ON CONFLICT DO NOTHING', [r.id, q.user_id]);
    }
    await client.query('COMMIT'); res.json({ status });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});
api.get('/history', async (req, res) => {
  res.json(await query(`SELECT h.id,h.snapshot,h.created_at FROM history h WHERE h.recipient_id=$1 OR EXISTS(
    SELECT 1 FROM participants p WHERE p.reservation_id=h.reservation_id AND p.user_id=$1)
    ORDER BY h.created_at DESC`, [person(req).id]));
});
api.get('/search', async (req, res) => {
  const q = z.string().trim().max(100).parse(req.query.q ?? '');
  if (!q) { res.json({ people: [], wishes: [] }); return; }
  const people = await query<Person>(`SELECT DISTINCT u.id,u.first_name,u.last_name,u.avatar,u.birth_date FROM users u
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 AND (u.first_name ILIKE $2 OR u.last_name ILIKE $2) LIMIT 50`,
    [person(req).household_id, `%${q}%`]);
  const wishesRows = await query<Wish>(`SELECT DISTINCT w.* FROM wishes w JOIN users u ON u.id=w.owner_id
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 AND w.deleted_at IS NULL AND w.gifted_at IS NULL AND NOT w.off_list
    AND (w.title ILIKE $2 OR EXISTS(SELECT 1 FROM unnest(w.tags) tag WHERE tag ILIKE $2)
      OR w.price::text ILIKE $2 OR u.first_name ILIKE $2 OR u.last_name ILIKE $2) LIMIT 100`,
    [person(req).household_id, `%${q}%`]);
  res.json({ people: people.map(publicPerson), wishes: await Promise.all(wishesRows.map(w => reservationView(w, person(req).id))) });
});
api.get('/dashboard', async (req, res) => {
  const actor = person(req);
  const people = await query<Person>(`SELECT DISTINCT u.id,u.first_name,u.last_name,u.avatar,u.birth_date FROM users u
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 ORDER BY u.first_name`, [actor.household_id]);
  const reservationsRows = await query<Reservation>(`SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r JOIN wishes w ON w.id=r.wish_id
    WHERE w.owner_id<>$1 AND r.cancelled_at IS NULL AND r.status!='gifted'
    AND (r.creator_id=$1 OR EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$1))
    AND EXISTS(SELECT 1 FROM users viewer JOIN memberships mine ON mine.household_id=viewer.household_id
      JOIN users recipient ON recipient.id=w.owner_id JOIN memberships theirs
        ON theirs.household_id=recipient.household_id AND theirs.family_id=mine.family_id
      WHERE viewer.id=$1)`, [actor.id]);
  const reservations = await Promise.all(reservationsRows.map(r => reservationDetails(r, actor.id)));
  const allOccasions = (await Promise.all(people.filter(p => p.id !== actor.id).map(async p => (await upcoming(actor, p.id))
    .filter(o => o.nextDate).map(o => ({ ...o, person: publicPerson(p) })))))
    .flat().sort((a, b) => (a.nextDate ?? '').localeCompare(b.nextDate ?? ''));
  const occasions = allOccasions.slice(0, 12);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const daysUntil = (date: string) => Math.round((new Date(date + 'T00:00:00Z').getTime() - today) / 86400_000);
  const covered = new Set(reservations.map(r => r.recipient.id));
  const todos: Record<string, unknown>[] = [];
  const noGift = new Set<string>();
  for (const o of allOccasions) {
    if (!o.nextDate || daysUntil(o.nextDate) > 30 || covered.has(o.person.id) || noGift.has(o.person.id)) continue;
    noGift.add(o.person.id);
    todos.push({ type: 'occasion_without_gift', date: o.nextDate, person: o.person, occasion: o.name });
  }
  const steps: Record<string, { type: string; limit: number }> = {
    reserved: { type: 'reservation_to_buy', limit: 14 },
    purchased: { type: 'reservation_to_wrap', limit: 7 },
    wrapped: { type: 'reservation_to_give', limit: 3 },
  };
  for (const r of reservations) {
    const step = steps[r.status ?? ''];
    if (!step || r.creator.id !== actor.id) continue;
    const names = new Set(r.occasions.map(o => (o as { name: string }).name));
    const next = allOccasions.find(o => o.person.id === r.recipient.id && names.has(o.name) && o.nextDate);
    todos.push({ type: step.type, date: next?.nextDate ?? null, urgent: !!next?.nextDate && daysUntil(next.nextDate) <= step.limit,
      person: r.recipient, occasion: next?.name ?? null,
      reservation: { id: r.id, wishTitle: r.wish?.title, status: r.status, wishDeleted: !!r.wishDeleted } });
  }
  const pending = await query<{id:string;title:string;count:string}>(`SELECT r.id,w.title,count(*) AS count FROM requests q
    JOIN reservations r ON r.id=q.reservation_id JOIN wishes w ON w.id=r.wish_id
    WHERE r.creator_id=$1 AND q.status='pending' AND r.cancelled_at IS NULL AND r.status<>'gifted'
    GROUP BY r.id,w.title ORDER BY w.title`, [actor.id]);
  for (const p of pending)
    todos.push({ type: 'pending_requests', count: Number(p.count), reservation: { id: p.id, wishTitle: p.title } });
  const rank = (t: Record<string, unknown>) => t.urgent ? 0 : t.type === 'occasion_without_gift' ? 1 : t.type === 'pending_requests' ? 2 : t.date ? 3 : 4;
  todos.sort((a, b) => rank(a) - rank(b) || String(a.date ?? '').localeCompare(String(b.date ?? '')));
  const onboarding = {
    hasWishes: !!await first('SELECT 1 FROM wishes WHERE owner_id=$1 AND deleted_at IS NULL AND NOT off_list LIMIT 1', [actor.id]),
    hasSharedFamily: !!await first(`SELECT 1 FROM memberships mine JOIN memberships other ON other.family_id=mine.family_id
      AND other.household_id<>mine.household_id WHERE mine.household_id=$1 LIMIT 1`, [actor.household_id]),
    hasNameDay: !!actor.name_day,
    hasReservation: !!await first(`SELECT 1 FROM reservations r WHERE r.creator_id=$1
      OR EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$1) LIMIT 1`, [actor.id]),
  };
  const others = people.filter(p => p.id !== actor.id).map(p => p.id);
  const openRows = await query<Reservation>(`SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r
    JOIN wishes w ON w.id=r.wish_id WHERE w.owner_id=ANY($2::uuid[]) AND ${offListVisibility} AND r.open_to_contributions
    AND r.creator_id<>$1 AND NOT EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$1)
    ORDER BY r.created_at`, [actor.id, others]);
  const openGifts = await Promise.all(openRows.map(r => withRequestStatus(r, actor.id)));
  res.json({ people: people.map(publicPerson), reservations: reservations.filter(r => r.creator.id === actor.id),
    participating: reservations.filter(r => r.creator.id !== actor.id), occasions, todos, onboarding, openGifts });
});
app.use('/api', (req, res) => res.vary('Accept-Language').status(404).json({ error: localized(req, 'Ressource introuvable') }));
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) { _next(error); return; }
  const pg = error as { code?: string; status?: number };
  const status = error instanceof HttpError ? error.code : error instanceof ZodError ? 400 :
    pg.status === 400 ? 400 : pg.status === 413 ? 413 :
      pg.code === '23505' ? 409 : pg.code === '23503' ? 400 : 500;
  if (status === 500) console.error(error);
  const message = error instanceof HttpError ? error.message :
    error instanceof ZodError || status === 400 ? 'Données invalides' :
      status === 409 ? 'Conflit' : status === 413 ? 'Corps trop volumineux' :
        status === 429 ? 'Trop de requêtes' : 'Erreur serveur';
  res.vary('Accept-Language');
  res.status(status).json({ error: localized(req, message) });
});
export { app };
