import express, { type Request, type Response, type NextFunction } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { z, ZodError } from 'zod';
import { rateLimit } from 'express-rate-limit';
import type { PersonView } from '../../../packages/contracts/src/index.js';
import { registerFamilyRoutes } from './routes/families.js';
import { registerWishRoutes } from './routes/wishes.js';
import { registerReservationRoutes } from './routes/reservations.js';
import { createWishService } from './services/wishes.js';
import { pool, query } from './db.js';
import { createDefaultOccasions } from './family.js';
import { preview } from './metadata.js';

export type Person = { id: string; household_id: string; first_name: string; last_name: string; email: string | null; birth_date: Date | string; name_day: string | null; avatar: string | null; household_admin?: boolean; password_hash?: string | null; managed?: boolean };
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
  'Membre géré introuvable': 'Managed member not found',
  'Ce membre gère son propre compte': 'This member manages their own account',
  'Un membre géré ne peut pas administrer': 'A managed member cannot administrate',
  'E-mail déjà utilisé': 'E-mail address already in use',
  'Code de rattachement invalide ou expiré': 'Invalid or expired claim code',
  'Cadeaux en cours pour ce membre': 'This member has gifts in progress',
  'Compte indépendant requis': 'An independent account is required',
  'Un foyer doit conserver un membre': 'A household must retain a member',
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
const httpUrl = z.url().max(2048).refine(v => /^https?:\/\//.test(v), 'URL HTTP(S) requise');
// A name day is a day of the year, not a date: it has no year attached. The refinement rejects
// the impossible combinations a plain pattern would let through, such as 02-31.
const nameDay = z.string().regex(/^\d{2}-\d{2}$/).refine(v => {
  const date = new Date(`2024-${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(5, 10) === v;
}, 'Date de fête invalide');
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
// A managed member is one without credentials. Queries that select whole rows carry the hash;
// those that pick columns alias `password_hash IS NULL AS managed` instead, so this never has
// to guess from a column that was not fetched.
const isManaged = (p: Person) => p.managed ?? p.password_hash === null;
const publicPerson = (p: Person): PersonView => ({ id: p.id, firstName: p.first_name, lastName: p.last_name, avatar: p.avatar, birthDate: birthday(p), managed: isManaged(p) });
const privatePerson = (p: Person): PersonView => ({ ...publicPerson(p), email: p.email, householdId: p.household_id, nameDay: p.name_day, householdAdmin: !!p.household_admin });
const requireHouseholdAdmin = async (p: Person) => {
  if (!await first('SELECT 1 FROM users WHERE id=$1 AND household_admin=true', [p.id]))
    fail(403, 'Administration du foyer requise');
};
// Household administration only ever applies to one's own household: there is no way to
// administrate someone else's, so the two checks always travel together.
const requireOwnHouseholdAdmin = async (p: Person, householdId: string) => {
  if (householdId !== p.household_id) fail(403, 'Administration du foyer requise');
  await requireHouseholdAdmin(p);
};
const managedMember = async (householdId: string, userId: string) => {
  const member = await first<Person>('SELECT * FROM users WHERE id=$1 AND household_id=$2', [userId, householdId]);
  if (!member) fail(404, 'Membre du foyer introuvable');
  if (!isManaged(member)) fail(409, 'Ce membre gère son propre compte');
  return member;
};
// Who may write in someone else's list: an administrator of the household a managed member
// belongs to. Nobody can curate the list of a person who has an account of their own.
const curates = async (actor: Person, ownerId: string) => !!await first(
  `SELECT 1 FROM users owner JOIN users actor ON actor.id=$1 AND actor.household_admin
   WHERE owner.id=$2 AND owner.password_hash IS NULL AND owner.household_id=actor.household_id`,
  [actor.id, ownerId]);
// A name day is only shown to the household itself: administrators need it to fill in the
// record of a member who cannot do it themselves. Relatives in the shared families keep the
// public projection, which leaves it out.
const householdMembers = async (householdId: string, withNameDay = false) =>
  (await query<Person>('SELECT * FROM users WHERE household_id=$1 ORDER BY first_name', [householdId]))
    .map(p => ({ ...publicPerson(p), householdAdmin: !!p.household_admin, ...(withNameDay ? { nameDay: p.name_day } : {}) }));
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
      // A code bound to a user is a claim code for a managed member, not a way in: it is
      // redeemed by POST /auth/claim, which fills in credentials rather than creating a person.
      const household = (await client.query<{household_id: string}>(`UPDATE invitations SET used_at=now()
        WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() AND user_id IS NULL AND (email IS NULL OR email=$2)
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
  const record = await first<Person & { password_hash: string }>('SELECT * FROM users WHERE email=$1 AND password_hash IS NOT NULL', [data.email.toLowerCase()]);
  if (!record || !await compare(data.password, record.password_hash)) fail(401, 'Identifiants invalides');
  const value = token();
  await query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'14 days\')', [digest(value), record.id]);
  sessionCookie(res, value, req);
  res.json(privatePerson(record));
});
// Public: the holder of a claim code has no account yet by definition. It attaches credentials
// to a person the household already created, so nothing about their identity is asked again.
api.post('/auth/claim', strictLimit, async (req, res) => {
  const data = z.object({ code: z.string(), email: z.email().toLowerCase(), password: z.string().min(12).max(128) }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claim = (await client.query<{user_id: string}>(`UPDATE invitations SET used_at=now()
      WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() AND user_id IS NOT NULL
      RETURNING user_id`, [digest(data.code)])).rows[0];
    if (!claim) fail(403, 'Code de rattachement invalide ou expiré');
    // The row may have gained credentials since the code was issued, through the direct route.
    const updated = (await client.query<Person>(`UPDATE users SET email=$2,password_hash=$3
      WHERE id=$1 AND password_hash IS NULL RETURNING *`,
    [claim.user_id, data.email, await hash(data.password, 12)])).rows[0];
    if (!updated) fail(409, 'Ce membre gère son propre compte');
    const value = token();
    await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'14 days\')',
      [digest(value), updated.id]);
    await client.query('COMMIT');
    sessionCookie(res, value, req);
    res.json(privatePerson(updated));
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
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
    avatar: z.url().nullable().optional(), nameDay: nameDay.nullable().optional() }).parse(req.body);
  const p = await first<Person>('UPDATE users SET first_name=$1,last_name=$2,avatar=$3,name_day=$4 WHERE id=$5 RETURNING *',
    [data.firstName, data.lastName, data.avatar === undefined ? person(req).avatar : data.avatar,
      data.nameDay === undefined ? person(req).name_day : data.nameDay, person(req).id]);
  res.json(privatePerson(p));
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

export type Wish = { id: string; owner_id: string; title: string; description: string | null; url: string | null; image: string | null; price: string | null; tags: string[]; position: number; deleted_at: Date | null; gifted_at: Date | null; off_list: boolean; created_by: string | null };
const wishFilters = z.strictObject({
  tag: z.string().trim().min(1).max(40).optional(),
  availability: z.enum(['available', 'reserved']).optional(),
  minPrice: z.coerce.number().finite().min(0).optional(),
  maxPrice: z.coerce.number().finite().min(0).optional(),
});

const wishInput = z.object({ title: z.string().trim().min(1).max(200), image: httpUrl.or(z.literal('')).nullish(),
  url: z.url().max(2048), description: z.string().max(5000).nullish(),
  price: z.coerce.number().min(0).max(99999999).nullable().optional(), tags: tags.default([]) });

export type Reservation = { id: string; wish_id: string; creator_id: string; status: string; open_to_contributions: boolean; cancelled_at: Date | null; created_at: Date; owner_id: string; deleted_at: Date | null; gifted_at: Date | null; off_list?: boolean };
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

const giftFields = {
  title: z.string().trim().min(1).max(200), description: z.string().max(5000).nullish(),
  price: z.coerce.number().min(0).max(99999999).nullish(), url: httpUrl.nullish(), image: httpUrl.nullish(),
};

const offListVisibility = `w.off_list AND r.cancelled_at IS NULL AND r.status!='gifted'`;
const withRequestStatus = async (r: Reservation, viewer: string) => ({
  ...await reservationDetails(r, viewer),
  requestStatus: (await first<{status:string}>('SELECT status FROM requests WHERE reservation_id=$1 AND user_id=$2', [r.id, viewer]))?.status ?? null,
});

const routeDeps = { pool, query, person, fail, uuid, first, visible, ownFamily, birthday, isManaged, publicPerson, requireHouseholdAdmin, requireOwnHouseholdAdmin, managedMember, curates, householdMembers, token, digest, hash, HttpError, nameDay, createDefaultOccasions, occasionData, upcoming, occasionMonthDay, wishFilters, preview, previewLimit, previewErrors, wishInput, tags, httpUrl, getReservation, reservationDetails, occasionInput, setOccasions, setParticipants, giftFields, offListVisibility, withRequestStatus };
export type RouteDeps = typeof routeDeps;
const wishes = createWishService(routeDeps);
registerFamilyRoutes(api, routeDeps);
registerWishRoutes(api, routeDeps, wishes);
registerReservationRoutes(api, routeDeps);
api.get('/history', async (req, res) => {
  res.json(await query(`SELECT h.id,h.snapshot,h.created_at FROM history h WHERE h.recipient_id=$1 OR EXISTS(
    SELECT 1 FROM participants p WHERE p.reservation_id=h.reservation_id AND p.user_id=$1)
    ORDER BY h.created_at DESC`, [person(req).id]));
});
api.get('/search', async (req, res) => {
  const q = z.string().trim().max(100).parse(req.query.q ?? '');
  if (!q) { res.json({ people: [], wishes: [] }); return; }
  const people = await query<Person>(`SELECT DISTINCT u.id,u.first_name,u.last_name,u.avatar,u.birth_date,u.password_hash IS NULL AS managed FROM users u
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 AND (u.first_name ILIKE $2 OR u.last_name ILIKE $2) LIMIT 50`,
    [person(req).household_id, `%${q}%`]);
  const wishesRows = await query<Wish>(`SELECT DISTINCT w.* FROM wishes w JOIN users u ON u.id=w.owner_id
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 AND w.deleted_at IS NULL AND w.gifted_at IS NULL AND NOT w.off_list
    AND (w.title ILIKE $2 OR EXISTS(SELECT 1 FROM unnest(w.tags) tag WHERE tag ILIKE $2)
      OR w.price::text ILIKE $2 OR u.first_name ILIKE $2 OR u.last_name ILIKE $2) LIMIT 100`,
    [person(req).household_id, `%${q}%`]);
  res.json({ people: people.map(publicPerson), wishes: await Promise.all(wishesRows.map(w => wishes.reservationView(w, person(req).id))) });
});
api.get('/dashboard', async (req, res) => {
  const actor = person(req);
  const people = await query<Person>(`SELECT DISTINCT u.id,u.first_name,u.last_name,u.avatar,u.birth_date,u.password_hash IS NULL AS managed FROM users u
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 ORDER BY u.first_name`, [actor.household_id]);
  const linkedReservationScope = `w.owner_id<>$1 AND r.cancelled_at IS NULL
    AND (r.creator_id=$1 OR EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$1))
    AND EXISTS(SELECT 1 FROM users viewer JOIN memberships mine ON mine.household_id=viewer.household_id
      JOIN users recipient ON recipient.id=w.owner_id JOIN memberships theirs
        ON theirs.household_id=recipient.household_id AND theirs.family_id=mine.family_id
      WHERE viewer.id=$1)`;
  // The active-reservation list shown to the organiser excludes completed gifts (they belong in
  // history, not in a todo), so it is built from active rows only — no need to hydrate the full
  // details of every historical gifted reservation just to render this list.
  const activeReservationRows = await query<Reservation>(`SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r JOIN wishes w ON w.id=r.wish_id
    WHERE r.status<>'gifted' AND ${linkedReservationScope}`, [actor.id]);
  const reservations = await Promise.all(activeReservationRows.map(r => reservationDetails(r, actor.id)));
  // A gift already marked as given early still answers "is there a gift planned for this
  // occasion?", so coverage must see completed reservations too, unlike the list above. This
  // only needs the occasion identity each reservation was linked to (not full reservation
  // details), fetched in one query regardless of how much gifting history the household has.
  const coverageRows = await query<{ recipient_id: string; name: string; kind: string; month: number | null; day: number | null; year: number }>(
    `SELECT w.owner_id AS recipient_id, o.name, o.kind, o.month, o.day, ro.year FROM reservations r
    JOIN wishes w ON w.id=r.wish_id JOIN reservation_occasions ro ON ro.reservation_id=r.id JOIN occasions o ON o.id=ro.occasion_id
    WHERE ${linkedReservationScope}`, [actor.id]);
  const allOccasions = (await Promise.all(people.filter(p => p.id !== actor.id).map(async p => (await upcoming(actor, p.id))
    .filter(o => o.nextDate).map(o => ({ ...o, person: publicPerson(p) })))))
    .flat().sort((a, b) => (a.nextDate ?? '').localeCompare(b.nextDate ?? ''));
  const occasions = allOccasions.slice(0, 12);
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  const daysUntil = (date: string) => Math.round((new Date(date + 'T00:00:00Z').getTime() - today) / 86400_000);
  // A reservation covers one specific occurrence of one specific occasion for one specific
  // person: recipient, occasion identity (name + kind + month/day, how shared-family duplicates
  // are deduplicated above — month/day disambiguates two fixed occasions sharing a name/kind)
  // and the year the buyer linked it to. Anything else — another person, another occasion,
  // another year, a cancelled reservation — must not hide the todo.
  const coveredOccasions = new Set(coverageRows.map(o =>
    JSON.stringify([o.recipient_id, o.name, o.kind, o.month, o.day, o.year])));
  const todos: Record<string, unknown>[] = [];
  const noGift = new Set<string>();
  for (const o of allOccasions) {
    if (!o.nextDate || daysUntil(o.nextDate) > 30 || noGift.has(o.person.id)) continue;
    const year = Number(o.nextDate.slice(0, 4));
    if (coveredOccasions.has(JSON.stringify([o.person.id, o.name, o.kind, o.month, o.day, year]))) continue;
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
  // An empty list for a managed member is the household's job to fill, so it belongs on the
  // administrator's board rather than nowhere: the child has no screen to be nagged on.
  if (actor.household_admin) {
    const emptyLists = await query<Person>(`SELECT u.* FROM users u WHERE u.household_id=$1 AND u.password_hash IS NULL
      AND NOT EXISTS(SELECT 1 FROM wishes w WHERE w.owner_id=u.id AND w.deleted_at IS NULL AND w.gifted_at IS NULL AND NOT w.off_list)
      ORDER BY u.first_name`, [actor.household_id]);
    for (const member of emptyLists) todos.push({ type: 'managed_list_empty', person: publicPerson(member) });
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
