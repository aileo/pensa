import type { Family as FamilyView, Household as HouseholdView } from '../../../../packages/contracts/src/index.js';
import type { Person, RouteDeps } from '../app.js';

export type MemberInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
  nameDay?: string | null;
  avatar?: string | null;
};
export type MemberUpdateInput = Partial<MemberInput> & { admin?: boolean };
export type OccasionInput = {
  name: string;
  kind: 'fixed' | 'birthday' | 'name_day';
  month?: number | null;
  day?: number | null;
};

type FamilyServiceDeps = Pick<
  RouteDeps,
  | 'publicPerson'
  | 'householdMembers'
  | 'query'
  | 'first'
  | 'fail'
  | 'requireOwnHouseholdAdmin'
  | 'managedMember'
  | 'pool'
  | 'isManaged'
  | 'HttpError'
  | 'token'
  | 'digest'
  | 'hash'
  | 'requireHouseholdAdmin'
  | 'ownFamily'
  | 'createDefaultOccasions'
  | 'upcoming'
>;

export const createFamilyService = (deps: FamilyServiceDeps) => {
  const {
    publicPerson,
    householdMembers,
    query,
    first,
    fail,
    requireOwnHouseholdAdmin,
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
    upcoming,
  } = deps;

  const authorizeHouseholdInvitation = async (actor: Person, id: string) => {
    if (
      id !== actor.household_id ||
      !(await first('SELECT 1 FROM users WHERE id=$1 AND household_admin', [actor.id]))
    )
      fail(403, 'Administration du foyer requise');
  };

  const listUsers = async (actor: Person) => {
    const rows = await query<Person>(
      `SELECT DISTINCT u.id,u.first_name,u.last_name,u.avatar,u.birth_date,u.password_hash IS NULL AS managed FROM users u
    JOIN memberships m ON m.household_id=u.household_id JOIN memberships mine ON mine.family_id=m.family_id
    WHERE mine.household_id=$1 ORDER BY u.first_name`,
      [actor.household_id],
    );
    return rows.map(publicPerson);
  };

  const listHouseholds = async (actor: Person) => {
    const rows = await query<{ id: string; name: string }>(
      `SELECT DISTINCT h.id,h.name FROM households h LEFT JOIN memberships m ON m.household_id=h.id
    LEFT JOIN memberships mine ON mine.family_id=m.family_id AND mine.household_id=$1
    WHERE h.id=$1 OR mine.household_id IS NOT NULL ORDER BY h.name`,
      [actor.household_id],
    );
    const households: HouseholdView[] = await Promise.all(
      rows.map(async (h) => {
        const mine = h.id === actor.household_id;
        return { ...h, mine, members: await householdMembers(h.id, mine) };
      }),
    );
    return households;
  };

  const getOwnHousehold = async (actor: Person) => {
    const h = await first<{ id: string; name: string }>('SELECT id,name FROM households WHERE id=$1', [
      actor.household_id,
    ]);
    return { ...h, members: await householdMembers(h.id, true) };
  };

  const createMember = async (actor: Person, id: string, data: MemberInput) => {
    await requireOwnHouseholdAdmin(actor, id);
    await query(
      'INSERT INTO users(household_id,first_name,last_name,birth_date,name_day,avatar) VALUES($1,$2,$3,$4,$5,$6)',
      [id, data.firstName, data.lastName, data.birthDate, data.nameDay ?? null, data.avatar ?? null],
    );
    return { members: await householdMembers(id, true) };
  };

  const updateMember = async (actor: Person, id: string, userId: string, data: MemberUpdateInput) => {
    await requireOwnHouseholdAdmin(actor, id);
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
        // Someone who cannot sign in could never exercise administration.
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
    return { members: await householdMembers(id, true) };
  };

  const deleteMember = async (actor: Person, id: string, userId: string) => {
    await requireOwnHouseholdAdmin(actor, id);
    await managedMember(id, userId);
    // Any gift, including past or cancelled gifts, prevents deletion to preserve its records.
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
    return { members: await householdMembers(id, true) };
  };

  const createMemberInvitation = async (actor: Person, id: string, userId: string) => {
    await requireOwnHouseholdAdmin(actor, id);
    await managedMember(id, userId);
    const value = token();
    await query(
      "INSERT INTO invitations(token_hash,household_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
      [digest(value), id, userId],
    );
    return { code: value, expiresInDays: 7 };
  };

  const createMemberAccount = async (
    actor: Person,
    id: string,
    userId: string,
    data: { email: string; password: string },
  ) => {
    await requireOwnHouseholdAdmin(actor, id);
    await managedMember(id, userId);
    await query('UPDATE users SET email=$2,password_hash=$3 WHERE id=$1', [
      userId,
      data.email,
      await hash(data.password, 12),
    ]);
    return { members: await householdMembers(id, true) };
  };

  const moveMemberOut = async (actor: Person, id: string, userId: string) => {
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
      if (isManaged(target)) fail(409, 'Compte indépendant requis');
      if (members.length < 2) fail(409, 'Un foyer doit conserver un membre');
      if (!members.some((m) => m.id !== userId && m.household_admin))
        fail(409, 'Un foyer doit conserver un administrateur');
      const household = (
        await client.query<{ id: string }>('INSERT INTO households(name) VALUES($1) RETURNING id', [
          `Foyer de ${target.first_name}`,
        ])
      ).rows[0];
      // Keep the departing member reachable in every family of the original household.
      await client.query(
        'INSERT INTO memberships(family_id,household_id) SELECT family_id,$2 FROM memberships WHERE household_id=$1',
        [id, household.id],
      );
      await client.query('UPDATE users SET household_id=$2,household_admin=true WHERE id=$1', [
        userId,
        household.id,
      ]);
      await client.query('COMMIT');
      return { householdId: household.id };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  const updateHousehold = async (actor: Person, id: string, data: { name: string }) => {
    const row = await first(
      'UPDATE households SET name=$1 WHERE id=$2 AND id=$3 AND EXISTS(SELECT 1 FROM users WHERE id=$4 AND household_admin=true) RETURNING *',
      [data.name, id, actor.household_id, actor.id],
    );
    if (!row) fail(403, 'Administration du foyer requise');
    return row;
  };

  const createHouseholdInvitation = async (actor: Person, id: string, data: { email?: string }) => {
    await authorizeHouseholdInvitation(actor, id);
    const value = token();
    await query(
      "INSERT INTO invitations(token_hash,household_id,email,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",
      [digest(value), id, data.email?.toLowerCase() ?? null],
    );
    return { code: value, expiresInDays: 7 };
  };

  const listFamilies = async (actor: Person) => {
    const rows = await query<{ id: string; name: string; admin: boolean }>(
      `SELECT f.*, EXISTS(SELECT 1 FROM family_admins a WHERE a.family_id=f.id AND a.user_id=$2) AS admin
    FROM families f JOIN memberships m ON m.family_id=f.id WHERE m.household_id=$1 ORDER BY f.name`,
      [actor.household_id, actor.id],
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
    return families;
  };

  const createFamily = async (actor: Person, data: { name: string }) => {
    await requireHouseholdAdmin(actor);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const family = (
        await client.query<{ id: string; name: string }>(
          'INSERT INTO families(name) VALUES($1) RETURNING *',
          [data.name],
        )
      ).rows[0];
      await client.query('INSERT INTO memberships VALUES($1,$2)', [family.id, actor.household_id]);
      await client.query('INSERT INTO family_admins VALUES($1,$2)', [family.id, actor.id]);
      await createDefaultOccasions(client, family.id);
      await client.query('COMMIT');
      return family;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  const updateFamily = async (actor: Person, id: string, data: { name: string }) => {
    await ownFamily(actor, id);
    return first('UPDATE families SET name=$1 WHERE id=$2 RETURNING *', [data.name, id]);
  };

  const createFamilyInvitation = async (actor: Person, id: string) => {
    await ownFamily(actor, id);
    const value = token();
    await query(
      "INSERT INTO family_invitations(token_hash,family_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [digest(value), id],
    );
    return { code: value, expiresInDays: 7 };
  };

  const joinFamily = async (actor: Person, data: { code: string }) => {
    await requireHouseholdAdmin(actor);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invite = (
        await client.query<{ family_id: string }>(
          `UPDATE family_invitations SET used_at=now()
      WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING family_id`,
          [digest(data.code)],
        )
      ).rows[0];
      if (!invite) fail(403, 'Invitation invalide ou expirée');
      if (
        (
          await client.query('SELECT 1 FROM memberships WHERE family_id=$1 AND household_id=$2', [
            invite.family_id,
            actor.household_id,
          ])
        ).rowCount
      )
        fail(409, 'Foyer déjà membre');
      await client.query('INSERT INTO memberships VALUES($1,$2)', [
        invite.family_id,
        actor.household_id,
      ]);
      await client.query('COMMIT');
      return { familyId: invite.family_id, householdId: actor.household_id };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  const removeFamilyHousehold = async (actor: Person, id: string, householdId: string) => {
    await ownFamily(actor, id);
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
      return { ok: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  const addFamilyAdmin = async (actor: Person, id: string, data: { userId: string }) => {
    await ownFamily(actor, id);
    const { userId } = data;
    if (
      !(await first(
        'SELECT 1 FROM users u JOIN memberships m ON m.household_id=u.household_id WHERE u.id=$1 AND m.family_id=$2',
        [userId, id],
      ))
    )
      fail(403, 'Utilisateur hors famille');
    if (await first('SELECT 1 FROM users WHERE id=$1 AND password_hash IS NULL', [userId]))
      fail(409, 'Un membre géré ne peut pas administrer');
    await query('INSERT INTO family_admins VALUES($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
    return { userId };
  };

  const listOccasions = async (actor: Person, recipientId: string) => upcoming(actor, recipientId);

  const createOccasion = async (actor: Person, id: string, data: OccasionInput) => {
    await ownFamily(actor, id);
    return first(
      'INSERT INTO occasions(family_id,name,kind,month,day) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [id, data.name, data.kind, data.month ?? null, data.day ?? null],
    );
  };

  const updateOccasion = async (actor: Person, id: string, data: OccasionInput) => {
    const row = await first<{ family_id: string }>('SELECT family_id FROM occasions WHERE id=$1', [id]);
    if (!row) fail(404, 'Occasion introuvable');
    await ownFamily(actor, row.family_id);
    return first('UPDATE occasions SET name=$1,kind=$2,month=$3,day=$4 WHERE id=$5 RETURNING *', [
      data.name,
      data.kind,
      data.month ?? null,
      data.day ?? null,
      id,
    ]);
  };

  const deleteOccasion = async (actor: Person, id: string) => {
    const row = await first<{ family_id: string }>('SELECT family_id FROM occasions WHERE id=$1', [id]);
    if (!row) fail(404, 'Occasion introuvable');
    await ownFamily(actor, row.family_id);
    if (await first('SELECT 1 FROM reservation_occasions WHERE occasion_id=$1 LIMIT 1', [id]))
      fail(409, 'Occasion utilisée dans une réservation');
    await query('DELETE FROM occasions WHERE id=$1', [id]);
    return { ok: true };
  };

  return {
    authorizeOwnHouseholdAdmin: requireOwnHouseholdAdmin,
    authorizeHouseholdAdmin: requireHouseholdAdmin,
    authorizeFamilyAdmin: ownFamily,
    authorizeHouseholdInvitation,
    listUsers,
    listHouseholds,
    getOwnHousehold,
    createMember,
    updateMember,
    deleteMember,
    createMemberInvitation,
    createMemberAccount,
    moveMemberOut,
    updateHousehold,
    createHouseholdInvitation,
    listFamilies,
    createFamily,
    updateFamily,
    createFamilyInvitation,
    joinFamily,
    removeFamilyHousehold,
    addFamilyAdmin,
    listOccasions,
    createOccasion,
    updateOccasion,
    deleteOccasion,
  };
};
