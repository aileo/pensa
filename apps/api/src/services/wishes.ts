import type { z } from 'zod';
import type { Person, RouteDeps, Wish } from '../app.js';

type WishServiceDeps = Pick<
  RouteDeps,
  'pool' | 'query' | 'first' | 'fail' | 'visible' | 'curates' | 'publicPerson' | 'preview' | 'previewErrors'
>;
type WishFilters = z.infer<RouteDeps['wishFilters']>;
type WishInput = z.infer<RouteDeps['wishInput']>;
type WishUpdate = z.infer<RouteDeps['wishUpdate']>;

export const createWishService = (deps: WishServiceDeps) => {
  const { pool, query, first, fail, visible, curates, publicPerson, preview, previewErrors } = deps;

  const wishAccess = async (id: string, viewer: string) => {
    const wish = await first<Wish>('SELECT * FROM wishes WHERE id=$1', [id]);
    if (!wish || wish.off_list || !(await visible(viewer, wish.owner_id))) {
      fail(404, 'Souhait introuvable');
    }
    return wish;
  };

  const reservationView = async (wish: Wish, viewer: string) => {
    const result: Record<string, unknown> = {
      id: wish.id,
      ownerId: wish.owner_id,
      title: wish.title,
      description: wish.description,
      url: wish.url,
      image: wish.image,
      price: wish.price,
      tags: wish.tags,
      position: wish.position,
    };
    if (wish.owner_id !== viewer) {
      const r = await first<{
        id: string;
        creator_id: string;
        open_to_contributions: boolean;
      }>(
        `SELECT id,creator_id,open_to_contributions FROM reservations
      WHERE wish_id=$1 AND cancelled_at IS NULL AND status!='gifted'`,
        [wish.id],
      );
      if (r) {
        const creator = await first<Person>('SELECT * FROM users WHERE id=$1', [r.creator_id]);
        const people = await query<Person>(
          'SELECT u.* FROM users u JOIN participants p ON p.user_id=u.id WHERE p.reservation_id=$1',
          [r.id],
        );
        result.reservation = {
          id: r.id,
          creator: publicPerson(creator),
          participants: people.map(publicPerson),
          openToContributions: r.open_to_contributions,
        };
      }
    }
    return result;
  };

  const listWishes = async (viewer: string, owner: string, filters: WishFilters = {}) => {
    if (!(await visible(viewer, owner))) fail(403, 'Personne inaccessible');
    const rows = await query<Wish>(
      `SELECT * FROM wishes WHERE owner_id=$1 AND deleted_at IS NULL AND gifted_at IS NULL AND NOT off_list
    ORDER BY position,created_at`,
      [owner],
    );
    const result = await Promise.all(rows.map((row) => reservationView(row, viewer)));
    return result.filter((row) => {
      if (filters.tag && !(row.tags as string[]).includes(String(filters.tag))) return false;
      if (filters.minPrice !== undefined && (row.price === null || Number(row.price) < filters.minPrice)) {
        return false;
      }
      if (filters.maxPrice !== undefined && (row.price === null || Number(row.price) > filters.maxPrice)) {
        return false;
      }
      if (
        filters.availability &&
        viewer !== owner &&
        (filters.availability === 'reserved') !== !!row.reservation
      ) {
        return false;
      }
      return true;
    });
  };

  const viewWish = async (viewer: string, id: string) => {
    const wish = await wishAccess(id, viewer);
    if (wish.deleted_at || wish.gifted_at) fail(404, 'Souhait introuvable');
    return reservationView(wish, viewer);
  };

  const previewWish = async (url: string) => {
    try {
      return await preview(url);
    } catch (e) {
      if (e instanceof Error) fail(400, previewErrors.has(e.message) ? e.message : 'Page inaccessible');
      throw e;
    }
  };

  const writableOwner = async (actor: Person, ownerId: string) => {
    if (ownerId !== actor.id && !(await curates(actor, ownerId))) fail(403, 'Personne inaccessible');
    return ownerId;
  };

  const createWish = async (actor: Person, ownerId: string, d: WishInput) => {
    if (!/^https?:\/\//.test(d.url)) fail(400, 'URL HTTP(S) requise');
    const owner = await writableOwner(actor, ownerId);
    const row = await first<Wish>(
      `INSERT INTO wishes(owner_id,title,image,url,description,price,tags,position)
    VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT count(*) FROM wishes WHERE owner_id=$1 AND NOT off_list)) RETURNING *`,
      [owner, d.title, d.image || null, d.url, d.description ?? null, d.price ?? null, d.tags],
    );
    return reservationView(row, actor.id);
  };

  const reorderWishes = async (actor: Person, ownerId: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) fail(400, 'Ordre invalide');
    const owner = await writableOwner(actor, ownerId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = (
        await client.query<{ id: string }>(
          'SELECT id FROM wishes WHERE owner_id=$1 AND deleted_at IS NULL AND gifted_at IS NULL AND NOT off_list FOR UPDATE',
          [owner],
        )
      ).rows;
      if (rows.length !== ids.length || rows.some((r) => !ids.includes(r.id))) {
        fail(400, 'Liste incomplète');
      }
      for (let i = 0; i < ids.length; i++) {
        await client.query('UPDATE wishes SET position=$1 WHERE id=$2', [i, ids[i]]);
      }
      await client.query('COMMIT');
      return { ok: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };

  const writableWish = async (actor: Person, id: string) => {
    const wish = await first<Wish>(
      'SELECT * FROM wishes WHERE id=$1 AND deleted_at IS NULL AND gifted_at IS NULL AND NOT off_list',
      [id],
    );
    if (!wish || (wish.owner_id !== actor.id && !(await curates(actor, wish.owner_id)))) {
      fail(404, 'Souhait introuvable');
    }
    return wish;
  };

  // The adapter authorizes before parsing the body to preserve the existing error precedence.
  // The title never appears here: it is immutable, with or without a reservation. Every other
  // key is optional — omitted means "leave this column alone" — so only the keys the caller
  // actually sent are written, and a tags-only call behaves exactly as it always has. A column
  // whose value is set to '' (for a link) or null is cleared rather than left untouched.
  const updateWish = async (actor: Person, wish: Wish, input: WishUpdate) => {
    const columns: { column: string; value: unknown }[] = [];
    if (input.url !== undefined) columns.push({ column: 'url', value: input.url || null });
    if (input.image !== undefined) columns.push({ column: 'image', value: input.image || null });
    if (input.description !== undefined) columns.push({ column: 'description', value: input.description });
    if (input.price !== undefined) columns.push({ column: 'price', value: input.price });
    if (input.tags !== undefined) columns.push({ column: 'tags', value: input.tags });
    if (!columns.length) return reservationView(wish, actor.id);
    const assignments = columns.map((c, i) => `${c.column}=$${i + 1}`).join(',');
    const row = await first<Wish>(
      `UPDATE wishes SET ${assignments} WHERE id=$${columns.length + 1} RETURNING *`,
      [...columns.map((c) => c.value), wish.id],
    );
    return reservationView(row, actor.id);
  };

  const deleteWish = async (actor: Person, id: string) => {
    const wish = await writableWish(actor, id);
    await query('UPDATE wishes SET deleted_at=now() WHERE id=$1', [wish.id]);
    return { ok: true };
  };

  return {
    listWishes,
    viewWish,
    wishAccess,
    reservationView,
    previewWish,
    createWish,
    reorderWishes,
    updateWish,
    deleteWish,
    writableOwner,
    writableWish,
  };
};
