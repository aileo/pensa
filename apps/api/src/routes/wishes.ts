import type { Router } from 'express';
import { z } from 'zod';
import type { Wish, RouteDeps } from '../app.js';

export const registerWishRoutes = (api: Router, deps: RouteDeps) => {
  const {
    person,
    query,
    first,
    fail,
    uuid,
    wishFilters,
    listWishes,
    wishAccess,
    reservationView,
    previewLimit,
    preview,
    previewErrors,
    addWish,
    reorderWishes,
    writableWish,
    tags,
  } = deps;
  api.get('/wishes', async (req, res) =>
    res.json(await listWishes(person(req).id, person(req).id, wishFilters.parse(req.query))),
  );
  api.get('/users/:id/wishes', async (req, res) =>
    res.json(await listWishes(person(req).id, uuid.parse(req.params.id), wishFilters.parse(req.query))),
  );
  api.get('/wishes/:id', async (req, res) => {
    const wish = await wishAccess(uuid.parse(req.params.id), person(req).id);
    if (wish.deleted_at || wish.gifted_at) fail(404, 'Souhait introuvable');
    res.json(await reservationView(wish, person(req).id));
  });
  api.post('/wishes/preview', previewLimit, async (req, res) => {
    const { url } = z.object({ url: z.url().max(2048) }).parse(req.body);
    try {
      res.json(await preview(url));
    } catch (e) {
      if (e instanceof Error) fail(400, previewErrors.has(e.message) ? e.message : 'Page inaccessible');
      throw e;
    }
  });
  api.post('/wishes', async (req, res) => addWish(req, res, person(req).id));
  api.post('/users/:id/wishes', async (req, res) => addWish(req, res, uuid.parse(req.params.id)));
  api.patch('/wishes/order', async (req, res) => reorderWishes(req, res, person(req).id));
  api.patch('/users/:id/wishes/order', async (req, res) =>
    reorderWishes(req, res, uuid.parse(req.params.id)),
  );
  api.patch('/wishes/:id', async (req, res) => {
    const wish = await writableWish(person(req), uuid.parse(req.params.id));
    const d = z.strictObject({ tags }).parse(req.body);
    const row = await first<Wish>('UPDATE wishes SET tags=$1 WHERE id=$2 RETURNING *', [d.tags, wish.id]);
    res.json(await reservationView(row, person(req).id));
  });
  api.delete('/wishes/:id', async (req, res) => {
    const wish = await writableWish(person(req), uuid.parse(req.params.id));
    await query('UPDATE wishes SET deleted_at=now() WHERE id=$1', [wish.id]);
    res.json({ ok: true });
  });
};
