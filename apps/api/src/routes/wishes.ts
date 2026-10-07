import type { Router } from 'express';
import { z } from 'zod';
import type { RouteDeps } from '../app.js';
import { createWishService } from '../services/wishes.js';

export const registerWishRoutes = (
  api: Router,
  deps: RouteDeps,
  wishes = createWishService(deps),
) => {
  const { person, uuid, wishFilters, previewLimit, wishInput, tags } = deps;
  const orderInput = z.object({ ids: z.array(uuid).max(1000) });
  const updateInput = z.strictObject({ tags });
  api.get('/wishes', async (req, res) =>
    res.json(await wishes.listWishes(person(req).id, person(req).id, wishFilters.parse(req.query))),
  );
  api.get('/users/:id/wishes', async (req, res) =>
    res.json(
      await wishes.listWishes(person(req).id, uuid.parse(req.params.id), wishFilters.parse(req.query)),
    ),
  );
  api.get('/wishes/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    res.json(await wishes.viewWish(person(req).id, id));
  });
  api.post('/wishes/preview', previewLimit, async (req, res) => {
    const { url } = z.object({ url: z.url().max(2048) }).parse(req.body);
    res.json(await wishes.previewWish(url));
  });
  api.post('/wishes', async (req, res) => {
    const ownerId = person(req).id;
    const input = wishInput.parse(req.body);
    res.status(201).json(await wishes.createWish(person(req), ownerId, input));
  });
  api.post('/users/:id/wishes', async (req, res) => {
    const ownerId = uuid.parse(req.params.id);
    const input = wishInput.parse(req.body);
    res.status(201).json(await wishes.createWish(person(req), ownerId, input));
  });
  api.patch('/wishes/order', async (req, res) => {
    const ownerId = person(req).id;
    const { ids } = orderInput.parse(req.body);
    res.json(await wishes.reorderWishes(person(req), ownerId, ids));
  });
  api.patch('/users/:id/wishes/order', async (req, res) => {
    const ownerId = uuid.parse(req.params.id);
    const { ids } = orderInput.parse(req.body);
    res.json(await wishes.reorderWishes(person(req), ownerId, ids));
  });
  api.patch('/wishes/:id', async (req, res) => {
    const wish = await wishes.writableWish(person(req), uuid.parse(req.params.id));
    const input = updateInput.parse(req.body);
    res.json(await wishes.updateWish(person(req), wish, input));
  });
  api.delete('/wishes/:id', async (req, res) => {
    res.json(await wishes.deleteWish(person(req), uuid.parse(req.params.id)));
  });
};
