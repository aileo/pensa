import type { Router } from 'express';
import { z } from 'zod';
import type { Wish, Reservation, RouteDeps } from '../app.js';

export const registerReservationRoutes = (api: Router, deps: RouteDeps) => {
  const {
    person,
    query,
    first,
    fail,
    uuid,
    pool,
    occasionInput,
    setOccasions,
    setParticipants,
    reservationDetails,
    getReservation,
    giftFields,
    withRequestStatus,
    offListVisibility,
    visible,
  } = deps;
  api.post('/reservations', async (req, res) => {
    const d = z
      .object({
        wishId: uuid,
        occasionIds: occasionInput,
        participantIds: z.array(uuid).default([]),
        openToContributions: z.boolean().default(false),
      })
      .parse(req.body);
    const actor = person(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const wish = (await client.query<Wish>('SELECT * FROM wishes WHERE id=$1 FOR UPDATE', [d.wishId]))
        .rows[0];
      if (!wish || wish.deleted_at || wish.gifted_at || wish.off_list) fail(404, 'Souhait indisponible');
      if (wish.owner_id === actor.id) fail(403, 'Impossible de réserver son propre souhait');
      const common = await client.query(
        `SELECT f.id FROM families f JOIN memberships mine ON mine.family_id=f.id
      JOIN users buyer ON buyer.household_id=mine.household_id
      JOIN users recipient ON recipient.id=$2 JOIN memberships theirs
        ON theirs.family_id=f.id AND theirs.household_id=recipient.household_id
      WHERE buyer.id=$1 ORDER BY f.id FOR SHARE OF f`,
        [actor.id, wish.owner_id],
      );
      if (!common.rowCount) fail(403, 'Personne inaccessible');
      if (
        (
          await client.query('SELECT 1 FROM reservations WHERE wish_id=$1 AND cancelled_at IS NULL', [
            wish.id,
          ])
        ).rowCount
      )
        fail(409, 'Souhait déjà réservé');
      const r = (
        await client.query<Reservation>(
          `INSERT INTO reservations(wish_id,creator_id,open_to_contributions)
      VALUES($1,$2,$3) RETURNING *`,
          [wish.id, actor.id, d.openToContributions],
        )
      ).rows[0];
      await setOccasions(client, r.id, wish.owner_id, actor.household_id, d.occasionIds);
      await setParticipants(client, r.id, wish.owner_id, actor.id, d.participantIds);
      await client.query('COMMIT');
      res
        .status(201)
        .json(
          await reservationDetails(
            { ...r, owner_id: wish.owner_id, deleted_at: null, gifted_at: null },
            actor.id,
          ),
        );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.post('/reservations/off-list', async (req, res) => {
    const d = z
      .object({
        recipientId: uuid,
        ...giftFields,
        occasionIds: occasionInput,
        participantIds: z.array(uuid).default([]),
        openToContributions: z.boolean().default(false),
      })
      .parse(req.body);
    const actor = person(req);
    if (d.recipientId === actor.id) fail(403, 'Impossible de prévoir un cadeau pour soi-même');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const common = await client.query(
        `SELECT f.id FROM families f JOIN memberships mine ON mine.family_id=f.id
      JOIN users buyer ON buyer.household_id=mine.household_id
      JOIN users recipient ON recipient.id=$2 JOIN memberships theirs
        ON theirs.family_id=f.id AND theirs.household_id=recipient.household_id
      WHERE buyer.id=$1 ORDER BY f.id FOR SHARE OF f`,
        [actor.id, d.recipientId],
      );
      if (!common.rowCount) fail(403, 'Personne inaccessible');
      const wish = (
        await client.query<Wish>(
          `INSERT INTO wishes(owner_id,title,description,price,url,image,off_list,created_by)
      VALUES($1,$2,$3,$4,$5,$6,true,$7) RETURNING *`,
          [
            d.recipientId,
            d.title,
            d.description ?? null,
            d.price ?? null,
            d.url ?? null,
            d.image ?? null,
            actor.id,
          ],
        )
      ).rows[0];
      const r = (
        await client.query<Reservation>(
          `INSERT INTO reservations(wish_id,creator_id,open_to_contributions)
      VALUES($1,$2,$3) RETURNING *`,
          [wish.id, actor.id, d.openToContributions],
        )
      ).rows[0];
      await setOccasions(client, r.id, d.recipientId, actor.household_id, d.occasionIds);
      await setParticipants(client, r.id, d.recipientId, actor.id, d.participantIds);
      await client.query('COMMIT');
      res
        .status(201)
        .json(
          await reservationDetails(
            { ...r, owner_id: d.recipientId, deleted_at: null, gifted_at: null, off_list: true },
            actor.id,
          ),
        );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.get('/users/:id/off-list', async (req, res) => {
    const owner = uuid.parse(req.params.id),
      viewer = person(req).id;
    if (owner === viewer) {
      res.json([]);
      return;
    }
    if (!(await visible(viewer, owner))) fail(403, 'Personne inaccessible');
    const rows = await query<Reservation>(
      `SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r
    JOIN wishes w ON w.id=r.wish_id WHERE w.owner_id=$1 AND ${offListVisibility}
    AND (r.open_to_contributions OR r.creator_id=$2 OR EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$2))
    ORDER BY r.created_at`,
      [owner, viewer],
    );
    res.json(await Promise.all(rows.map((r) => withRequestStatus(r, viewer))));
  });
  api.get('/reservations', async (req, res) => {
    const rows = await query<Reservation>(
      `SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r
    JOIN wishes w ON w.id=r.wish_id WHERE w.owner_id<>$1 AND
    (r.creator_id=$1 OR EXISTS(SELECT 1 FROM participants p WHERE p.reservation_id=r.id AND p.user_id=$1))
    AND EXISTS(SELECT 1 FROM users viewer JOIN memberships mine ON mine.household_id=viewer.household_id
      JOIN users recipient ON recipient.id=w.owner_id JOIN memberships theirs
        ON theirs.household_id=recipient.household_id AND theirs.family_id=mine.family_id
      WHERE viewer.id=$1)
    ORDER BY r.created_at DESC`,
      [person(req).id],
    );
    res.json(await Promise.all(rows.map((row) => reservationDetails(row, person(req).id))));
  });
  api.get('/reservations/:id', async (req, res) => {
    const r = await getReservation(uuid.parse(req.params.id), person(req).id);
    res.json(await reservationDetails(r, person(req).id));
  });
  api.patch('/reservations/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const d = z
      .strictObject({
        occasionIds: occasionInput.optional(),
        participantIds: z.array(uuid).optional(),
        openToContributions: z.boolean().optional(),
        status: z.enum(['reserved', 'purchased', 'wrapped', 'gifted']).optional(),
        gift: z.strictObject(giftFields).optional(),
      })
      .parse(req.body);
    const actor = person(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = (
        await client.query<Reservation>(
          `SELECT r.*,w.owner_id,w.deleted_at,w.gifted_at,w.off_list FROM reservations r
      JOIN wishes w ON w.id=r.wish_id WHERE r.id=$1 FOR UPDATE OF r,w`,
          [id],
        )
      ).rows[0];
      if (!r || r.owner_id === actor.id) fail(404, 'Réservation introuvable');
      if (r.creator_id !== actor.id) fail(403, 'Créateur requis');
      if (r.cancelled_at || r.status === 'gifted') fail(409, 'Réservation terminée');
      if (r.deleted_at && d.status === 'gifted') fail(409, 'Souhait supprimé');
      if (d.status && d.status !== r.status) {
        const moves: Record<string, string[]> = {
          reserved: ['purchased'],
          purchased: ['reserved', 'wrapped'],
          wrapped: ['purchased', 'gifted'],
        };
        if (!moves[r.status]?.includes(d.status)) fail(409, 'Transition de statut interdite');
      }
      if (d.occasionIds) await setOccasions(client, id, r.owner_id, actor.household_id, d.occasionIds);
      if (d.participantIds) await setParticipants(client, id, r.owner_id, actor.id, d.participantIds);
      if (d.gift) {
        if (!r.off_list) fail(409, 'Seul un cadeau hors liste peut être modifié');
        await client.query('UPDATE wishes SET title=$1,description=$2,price=$3,url=$4,image=$5 WHERE id=$6', [
          d.gift.title,
          d.gift.description ?? null,
          d.gift.price ?? null,
          d.gift.url ?? null,
          d.gift.image ?? null,
          r.wish_id,
        ]);
      }
      await client.query(
        'UPDATE reservations SET status=COALESCE($1,status),open_to_contributions=COALESCE($2,open_to_contributions) WHERE id=$3',
        [d.status ?? null, d.openToContributions ?? null, id],
      );
      if (d.status === 'gifted') {
        const wish = (
          await client.query<Wish>('UPDATE wishes SET gifted_at=now() WHERE id=$1 RETURNING *', [r.wish_id])
        ).rows[0];
        const people = (
          await client.query(
            'SELECT u.id,u.first_name,u.last_name FROM users u JOIN participants p ON p.user_id=u.id WHERE p.reservation_id=$1',
            [id],
          )
        ).rows;
        const recipient = (
          await client.query('SELECT id,first_name,last_name,birth_date FROM users WHERE id=$1', [r.owner_id])
        ).rows[0];
        const creator = people.find((p) => p.id === r.creator_id);
        const occ = (
          await client.query(
            'SELECT o.name,o.kind,ro.year FROM reservation_occasions ro JOIN occasions o ON o.id=ro.occasion_id WHERE ro.reservation_id=$1 ORDER BY ro.year',
            [id],
          )
        ).rows;
        await client.query('INSERT INTO history(reservation_id,recipient_id,snapshot) VALUES($1,$2,$3)', [
          id,
          r.owner_id,
          JSON.stringify({
            ...wish,
            recipientId: r.owner_id,
            creatorId: r.creator_id,
            recipient,
            creator,
            participants: people,
            occasions: occ,
            reservedAt: r.created_at,
            giftedAt: wish.gifted_at,
          }),
        ]);
      }
      await client.query('COMMIT');
      res.json(await reservationDetails({ ...r, status: d.status ?? r.status }, actor.id));
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.delete('/reservations/:id', async (req, res) => {
    const r = await getReservation(uuid.parse(req.params.id), person(req).id);
    if (r.creator_id !== person(req).id) fail(403, 'Créateur requis');
    const row = await first(
      "UPDATE reservations SET cancelled_at=now() WHERE id=$1 AND creator_id=$2 AND cancelled_at IS NULL AND status!='gifted' RETURNING id",
      [r.id, person(req).id],
    );
    if (!row) fail(409, 'Réservation terminée');
    if (r.off_list)
      await query('UPDATE wishes SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL', [r.wish_id]);
    res.json({ ok: true });
  });
  api.post('/reservations/:id/requests', async (req, res) => {
    const r = await getReservation(uuid.parse(req.params.id), person(req).id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = (
        await client.query<Reservation>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [r.id])
      ).rows[0];
      if (
        current.cancelled_at ||
        current.status === 'gifted' ||
        !current.open_to_contributions ||
        current.creator_id === person(req).id
      )
        fail(409, 'Participation fermée');
      if (
        (
          await client.query('SELECT 1 FROM participants WHERE reservation_id=$1 AND user_id=$2', [
            r.id,
            person(req).id,
          ])
        ).rowCount
      )
        fail(409, 'Déjà participant');
      const row = (
        await client.query(
          `INSERT INTO requests(reservation_id,user_id) VALUES($1,$2)
      ON CONFLICT(reservation_id,user_id) DO UPDATE SET status='pending' RETURNING *`,
          [r.id, person(req).id],
        )
      ).rows[0];
      await client.query('COMMIT');
      res.status(201).json(row);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
  api.get('/reservations/:id/requests', async (req, res) => {
    const r = await getReservation(uuid.parse(req.params.id), person(req).id);
    if (r.creator_id !== person(req).id) fail(403, 'Créateur requis');
    res.json(
      await query(
        `SELECT q.id,q.status,u.id AS "userId",u.first_name AS "firstName",u.last_name AS "lastName"
    FROM requests q JOIN users u ON u.id=q.user_id WHERE q.reservation_id=$1`,
        [r.id],
      ),
    );
  });
  api.patch('/reservations/:id/requests/:requestId', async (req, res) => {
    const r = await getReservation(uuid.parse(req.params.id), person(req).id);
    if (r.creator_id !== person(req).id) fail(403, 'Créateur requis');
    const { status } = z.object({ status: z.enum(['accepted', 'refused']) }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = (
        await client.query<Reservation>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [r.id])
      ).rows[0];
      if (current.cancelled_at || current.status === 'gifted') fail(409, 'Réservation terminée');
      const q = (
        await client.query<{ user_id: string }>(
          `UPDATE requests SET status=$1 WHERE id=$2 AND reservation_id=$3 AND status='pending' RETURNING user_id`,
          [status, uuid.parse(req.params.requestId), r.id],
        )
      ).rows[0];
      if (!q) fail(404, 'Demande introuvable');
      if (status === 'accepted') {
        const access = await client.query(
          `SELECT f.id FROM families f
        JOIN memberships requester ON requester.family_id=f.id
        JOIN users applicant ON applicant.household_id=requester.household_id AND applicant.id=$1
        JOIN memberships recipient ON recipient.family_id=f.id
        JOIN users beneficiary ON beneficiary.household_id=recipient.household_id AND beneficiary.id=$2
        FOR SHARE OF f`,
          [q.user_id, r.owner_id],
        );
        if (!access.rowCount) fail(403, 'Participant hors des familles du bénéficiaire');
        await client.query('INSERT INTO participants VALUES($1,$2) ON CONFLICT DO NOTHING', [
          r.id,
          q.user_id,
        ]);
      }
      await client.query('COMMIT');
      res.json({ status });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });
};
