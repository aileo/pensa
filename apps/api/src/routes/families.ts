import type { Router } from 'express';
import { z } from 'zod';
import type { Family as FamilyView, Household as HouseholdView } from '../../../../packages/contracts/src/index.js';
import type { Person, RouteDeps } from '../app.js';

export const registerFamilyRoutes = (api: Router, deps: RouteDeps) => {
  const {
    person,
    publicPerson,
    householdMembers,
    query,
    first,
    fail,
    uuid,
    requireOwnHouseholdAdmin,
    nameDay,
    managedMember,
    pool,
    isManaged,
    HttpError,
    token,
    digest,
    hash,
    requireHouseholdAdmin,
    ownFamily,
    createDefaultOccasions,
    occasionData,
    upcoming,
  } = deps;
  api.get('/users', async (req, res) => {
    const rows = await query<Person>(
      `SELECT DISTINCT u.id,u.first_name,u.last_name,u.avatar,u.birth_date,u.password_hash IS NULL AS managed FROM users u
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 ORDER BY u.first_name`,
      [person(req).household_id],
    );
    res.json(rows.map(publicPerson));
  });
  api.get('/households', async (req, res) => {
    const rows = await query<{ id: string; name: string }>(
      `SELECT DISTINCT h.id,h.name FROM households h LEFT JOIN memberships m ON m.household_id=h.id
    LEFT JOIN memberships mine ON mine.family_id=m.family_id AND mine.household_id=$1
    WHERE h.id=$1 OR mine.household_id IS NOT NULL ORDER BY h.name`,
      [person(req).household_id],
    );
    const households: HouseholdView[] = await Promise.all(
      rows.map(async (h) => {
        const mine = h.id === person(req).household_id;
        return { ...h, mine, members: await householdMembers(h.id, mine) };
      }),
    );
    res.json(households);
  });
  api.get('/households/mine', async (req, res) => {
    const h = await first<{ id: string; name: string }>('SELECT id,name FROM households WHERE id=$1', [
      person(req).household_id,
    ]);
    res.json({ ...h, members: await householdMembers(h.id, true) });
  });
  // Members of a household who have no account of their own: children, mostly. They are real
  // people in the database — they receive gifts, they appear in families, they can take part in
  // someone else's present — they simply have no way to sign in, so an administrator of their
  // household writes their list for them.
  api.post('/households/:id/members', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await requireOwnHouseholdAdmin(person(req), id);
    const data = z
      .object({
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().min(1).max(100),
        birthDate: z.iso.date(),
        nameDay: nameDay.nullish(),
        avatar: z.string().trim().max(500).nullish(),
      })
      .parse(req.body);
    await query(
      'INSERT INTO users(household_id,first_name,last_name,birth_date,name_day,avatar) VALUES($1,$2,$3,$4,$5,$6)',
      [id, data.firstName, data.lastName, data.birthDate, data.nameDay ?? null, data.avatar ?? null],
    );
    res.status(201).json({ members: await householdMembers(id, true) });
  });
  api.patch('/households/:id/members/:userId', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    const data = z
      .object({
        admin: z.boolean().optional(),
        firstName: z.string().trim().min(1).max(100).optional(),
        lastName: z.string().trim().min(1).max(100).optional(),
        birthDate: z.iso.date().optional(),
        nameDay: nameDay.nullish(),
        avatar: z.string().trim().max(500).nullish(),
      })
      .parse(req.body);
    await requireOwnHouseholdAdmin(person(req), id);
    // Identity is only editable for managed members: everyone else owns their own profile.
    const profile: [string, unknown][] = [];
    if (data.firstName !== undefined) profile.push(['first_name', data.firstName]);
    if (data.lastName !== undefined) profile.push(['last_name', data.lastName]);
    if (data.birthDate !== undefined) profile.push(['birth_date', data.birthDate]);
    if (data.nameDay !== undefined) profile.push(['name_day', data.nameDay]);
    if (data.avatar !== undefined) profile.push(['avatar', data.avatar]);
    if (profile.length) {
      await managedMember(id, userId);
      await query(`UPDATE users SET ${profile.map(([c], i) => `${c}=$${i + 2}`).join(',')} WHERE id=$1`, [
        userId,
        ...profile.map(([, v]) => v),
      ]);
    }
    if (data.admin !== undefined) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const members = (
          await client.query<Person>('SELECT * FROM users WHERE household_id=$1 FOR UPDATE', [id])
        ).rows;
        const target = members.find((m) => m.id === userId);
        if (!target) throw new HttpError(404, 'Membre du foyer introuvable');
        // Administration means acting on behalf of the household; someone who cannot sign in
        // could never exercise it, and granting it would only create an unreachable admin.
        if (data.admin && isManaged(target)) fail(409, 'Un membre géré ne peut pas administrer');
        if (!data.admin && !members.some((m) => m.id !== userId && m.household_admin))
          fail(409, 'Un foyer doit conserver un administrateur');
        await client.query('UPDATE users SET household_admin=$1 WHERE id=$2', [data.admin, userId]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    res.json({ members: await householdMembers(id, true) });
  });
  // Hard delete, because a person kept around as a tombstone would still show up in every family
  // listing. It is refused as soon as any gift — past, present or cancelled — points at them, so
  // no record is ever orphaned or silently rewritten.
  api.delete('/households/:id/members/:userId', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    await requireOwnHouseholdAdmin(person(req), id);
    await managedMember(id, userId);
    const engaged = await first(
      `SELECT 1 FROM reservations r JOIN wishes w ON w.id=r.wish_id
      WHERE w.owner_id=$1 OR r.creator_id=$1
    UNION ALL SELECT 1 FROM participants WHERE user_id=$1
    UNION ALL SELECT 1 FROM requests WHERE user_id=$1
    UNION ALL SELECT 1 FROM history WHERE recipient_id=$1 LIMIT 1`,
      [userId],
    );
    if (engaged) fail(409, 'Cadeaux en cours pour ce membre');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM invitations WHERE user_id=$1', [userId]);
      await client.query('DELETE FROM wishes WHERE owner_id=$1 OR created_by=$1', [userId]);
      await client.query('DELETE FROM users WHERE id=$1', [userId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ members: await householdMembers(id, true) });
  });
  api.post('/households/:id/members/:userId/invitations', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    await requireOwnHouseholdAdmin(person(req), id);
    await managedMember(id, userId);
    const value = token();
    await query(
      "INSERT INTO invitations(token_hash,household_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
      [digest(value), id, userId],
    );
    res.status(201).json({ code: value, expiresInDays: 7 });
  });
  // Two ways to turn a managed member into an independent account. A code lets the person choose
  // their own password without an administrator ever knowing it; direct entry covers the case
  // where they are sitting next to each other and that ceremony is pointless.
  api.post('/households/:id/members/:userId/account', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    await requireOwnHouseholdAdmin(person(req), id);
    const data = z
      .object({ email: z.email().toLowerCase(), password: z.string().min(12).max(128) })
      .parse(req.body);
    await managedMember(id, userId);
    await query('UPDATE users SET email=$2,password_hash=$3 WHERE id=$1', [
      userId,
      data.email,
      await hash(data.password, 12),
    ]);
    res.json({ members: await householdMembers(id, true) });
  });
  // Leaving home. The new household joins every family the old one belongs to, so the person stays
  // reachable by the relatives who already knew them instead of having to be invited back in.
  api.post('/households/:id/members/:userId/move-out', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    const actor = person(req);
    if (id !== actor.household_id) fail(403, 'Administration du foyer requise');
    if (userId !== actor.id) await requireHouseholdAdmin(actor);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const members = (
        await client.query<Person>('SELECT * FROM users WHERE household_id=$1 FOR UPDATE', [id])
      ).rows;
      const target = members.find((m) => m.id === userId);
      if (!target) throw new HttpError(404, 'Membre du foyer introuvable');
      // Without credentials there would be nobody to administrate the new household.
      if (isManaged(target)) fail(409, 'Compte indépendant requis');
      if (members.length < 2) fail(409, 'Un foyer doit conserver un membre');
      if (!members.some((m) => m.id !== userId && m.household_admin))
        fail(409, 'Un foyer doit conserver un administrateur');
      const household = (
        await client.query<{ id: string }>('INSERT INTO households(name) VALUES($1) RETURNING id', [
          `Foyer de ${target.first_name}`,
        ])
      ).rows[0];
      await client.query(
        'INSERT INTO memberships(family_id,household_id) SELECT family_id,$2 FROM memberships WHERE household_id=$1',
        [id, household.id],
      );
      await client.query('UPDATE users SET household_id=$2,household_admin=true WHERE id=$1', [
        userId,
        household.id,
      ]);
      await client.query('COMMIT');
      res.json({ householdId: household.id });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.patch('/households/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      data = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
    const row = await first(
      'UPDATE households SET name=$1 WHERE id=$2 AND id=$3 AND EXISTS(SELECT 1 FROM users WHERE id=$4 AND household_admin=true) RETURNING *',
      [data.name, id, person(req).household_id, person(req).id],
    );
    if (!row) fail(403, 'Administration du foyer requise');
    res.json(row);
  });
  api.post('/households/:id/invitations', async (req, res) => {
    const id = uuid.parse(req.params.id);
    if (
      id !== person(req).household_id ||
      !(await first('SELECT 1 FROM users WHERE id=$1 AND household_admin', [person(req).id]))
    )
      fail(403, 'Administration du foyer requise');
    const data = z.object({ email: z.email().optional() }).parse(req.body);
    const value = token();
    await query(
      "INSERT INTO invitations(token_hash,household_id,email,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
      [digest(value), id, data.email?.toLowerCase() ?? null],
    );
    res.status(201).json({ code: value, expiresInDays: 7 });
  });
  api.get('/families', async (req, res) => {
    const rows = await query<{ id: string; name: string; admin: boolean }>(
      `SELECT f.*, EXISTS(SELECT 1 FROM family_admins a WHERE a.family_id=f.id AND a.user_id=$2) AS admin
    FROM families f JOIN memberships m ON m.family_id=f.id WHERE m.household_id=$1 ORDER BY f.name`,
      [person(req).household_id, person(req).id],
    );
    const families: FamilyView[] = await Promise.all(
      rows.map(async (f) => {
          const admins = new Set(
            (
              await query<{ user_id: string }>('SELECT user_id FROM family_admins WHERE family_id=$1', [f.id])
            ).map((a) => a.user_id),
          );
          const households = await query<{ id: string; name: string }>(
            `SELECT h.id,h.name FROM households h JOIN memberships m ON m.household_id=h.id
      WHERE m.family_id=$1 ORDER BY h.name`,
            [f.id],
          );
          return {
            ...f,
            members: (
              await query<Person>(
                `SELECT u.* FROM users u JOIN memberships m ON m.household_id=u.household_id
        WHERE m.family_id=$1 ORDER BY u.first_name`,
                [f.id],
              )
            ).map((p) => ({ ...publicPerson(p), familyAdmin: admins.has(p.id) })),
            households: await Promise.all(
              households.map(async (h) => ({
                ...h,
                members: (await householdMembers(h.id)).map((m) => ({ ...m, familyAdmin: admins.has(m.id) })),
              })),
            ),
          };
      }),
    );
    res.json(families);
  });
  api.post('/families', async (req, res) => {
    await requireHouseholdAdmin(person(req));
    const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const family = (
        await client.query<{ id: string; name: string }>(
          'INSERT INTO families(name) VALUES($1) RETURNING *',
          [name],
        )
      ).rows[0];
      await client.query('INSERT INTO memberships VALUES($1,$2)', [family.id, person(req).household_id]);
      await client.query('INSERT INTO family_admins VALUES($1,$2)', [family.id, person(req).id]);
      await createDefaultOccasions(client, family.id);
      await client.query('COMMIT');
      res.status(201).json(family);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.patch('/families/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await ownFamily(person(req), id);
    const { name } = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
    res.json(await first('UPDATE families SET name=$1 WHERE id=$2 RETURNING *', [name, id]));
  });
  api.post('/families/:id/invitations', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await ownFamily(person(req), id);
    const value = token();
    await query(
      "INSERT INTO family_invitations(token_hash,family_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [digest(value), id],
    );
    res.status(201).json({ code: value, expiresInDays: 7 });
  });
  api.post('/families/join', async (req, res) => {
    await requireHouseholdAdmin(person(req));
    const { code } = z.object({ code: z.string().min(1).max(128) }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invite = (
        await client.query<{ family_id: string }>(
          `UPDATE family_invitations SET used_at=now()
      WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING family_id`,
          [digest(code)],
        )
      ).rows[0];
      if (!invite) fail(403, 'Invitation invalide ou expirée');
      if (
        (
          await client.query('SELECT 1 FROM memberships WHERE family_id=$1 AND household_id=$2', [
            invite.family_id,
            person(req).household_id,
          ])
        ).rowCount
      )
        fail(409, 'Foyer déjà membre');
      await client.query('INSERT INTO memberships VALUES($1,$2)', [
        invite.family_id,
        person(req).household_id,
      ]);
      await client.query('COMMIT');
      res.status(201).json({ familyId: invite.family_id, householdId: person(req).household_id });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.delete('/families/:id/households/:householdId', async (req, res) => {
    const id = uuid.parse(req.params.id),
      householdId = uuid.parse(req.params.householdId);
    await ownFamily(person(req), id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM families WHERE id=$1 FOR UPDATE', [id]);
      const count = (
        await client.query<{ count: string }>('SELECT count(*) FROM memberships WHERE family_id=$1', [id])
      ).rows[0];
      if (Number(count.count) <= 1) fail(409, 'Une famille doit conserver un foyer');
      const active = await client.query(
        `SELECT 1 FROM reservations r JOIN wishes w ON w.id=r.wish_id
      JOIN users owner ON owner.id=w.owner_id JOIN users creator ON creator.id=r.creator_id
      JOIN memberships scope ON scope.household_id=owner.household_id AND scope.family_id=$1
      WHERE r.cancelled_at IS NULL AND r.status!='gifted' AND
      (owner.household_id=$2 OR creator.household_id=$2 OR EXISTS(
        SELECT 1 FROM participants p JOIN users member ON member.id=p.user_id
        WHERE p.reservation_id=r.id AND member.household_id=$2)) LIMIT 1`,
        [id, householdId],
      );
      if (active.rowCount) fail(409, 'Terminer les réservations avant de retirer ce foyer');
      await client.query(
        'DELETE FROM family_admins WHERE family_id=$1 AND user_id IN(SELECT id FROM users WHERE household_id=$2)',
        [id, householdId],
      );
      const admins = (
        await client.query<{ count: string }>('SELECT count(*) FROM family_admins WHERE family_id=$1', [id])
      ).rows[0];
      if (!Number(admins.count)) fail(409, 'Une famille doit conserver un administrateur');
      await client.query('DELETE FROM memberships WHERE family_id=$1 AND household_id=$2', [id, householdId]);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.post('/families/:id/admins', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await ownFamily(person(req), id);
    const { userId } = z.object({ userId: uuid }).parse(req.body);
    if (
      !(await first(
        'SELECT 1 FROM users u JOIN memberships m ON m.household_id=u.household_id WHERE u.id=$1 AND m.family_id=$2',
        [userId, id],
      ))
    )
      fail(403, 'Utilisateur hors famille');
    // Same reasoning as household administration: nobody who cannot sign in can exercise it.
    if (await first('SELECT 1 FROM users WHERE id=$1 AND password_hash IS NULL', [userId]))
      fail(409, 'Un membre géré ne peut pas administrer');
    await query('INSERT INTO family_admins VALUES($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
    res.status(201).json({ userId });
  });
  api.get('/occasions', async (req, res) => {
    res.json(await upcoming(person(req), uuid.parse(req.query.recipientId ?? person(req).id)));
  });
  api.post('/families/:id/occasions', async (req, res) => {
    const id = uuid.parse(req.params.id);
    await ownFamily(person(req), id);
    const d = occasionData.parse(req.body);
    res
      .status(201)
      .json(
        await first(
          'INSERT INTO occasions(family_id,name,kind,month,day) VALUES($1,$2,$3,$4,$5) RETURNING *',
          [id, d.name, d.kind, d.month ?? null, d.day ?? null],
        ),
      );
  });
  api.patch('/occasions/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      d = occasionData.parse(req.body);
    const row = await first<{ family_id: string }>('SELECT family_id FROM occasions WHERE id=$1', [id]);
    if (!row) fail(404, 'Occasion introuvable');
    await ownFamily(person(req), row.family_id);
    res.json(
      await first('UPDATE occasions SET name=$1,kind=$2,month=$3,day=$4 WHERE id=$5 RETURNING *', [
        d.name,
        d.kind,
        d.month ?? null,
        d.day ?? null,
        id,
      ]),
    );
  });
  api.delete('/occasions/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const row = await first<{ family_id: string }>('SELECT family_id FROM occasions WHERE id=$1', [id]);
    if (!row) fail(404, 'Occasion introuvable');
    await ownFamily(person(req), row.family_id);
    if (await first('SELECT 1 FROM reservation_occasions WHERE occasion_id=$1 LIMIT 1', [id]))
      fail(409, 'Occasion utilisée dans une réservation');
    await query('DELETE FROM occasions WHERE id=$1', [id]);
    res.json({ ok: true });
  });
};
