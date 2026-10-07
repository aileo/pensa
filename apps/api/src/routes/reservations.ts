import type { Router } from 'express';
import { z } from 'zod';
import type { RouteDeps } from '../app.js';
import { createReservationService } from '../services/reservations.js';

export const registerReservationRoutes = (api: Router, deps: RouteDeps) => {
  const { person, uuid, occasionInput, giftFields } = deps;
  const service = createReservationService(deps);

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
    const result = await service.create(actor, d);
    res.status(201).json(result);
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
    const result = await service.createOffList(actor, d);
    res.status(201).json(result);
  });

  api.get('/users/:id/off-list', async (req, res) => {
    const owner = uuid.parse(req.params.id),
      viewer = person(req).id;
    res.json(await service.listOffList(viewer, owner));
  });

  api.get('/reservations', async (req, res) => {
    res.json(await service.list(person(req).id));
  });

  api.get('/reservations/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    res.json(await service.detail(person(req).id, id));
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
    res.json(await service.update(actor, id, d));
  });

  api.delete('/reservations/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    res.json(await service.cancel(person(req).id, id));
  });

  api.post('/reservations/:id/requests', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const result = await service.createRequest(person(req).id, id);
    res.status(201).json(result);
  });

  api.get('/reservations/:id/requests', async (req, res) => {
    const id = uuid.parse(req.params.id);
    res.json(await service.listRequests(person(req).id, id));
  });

  api.patch('/reservations/:id/requests/:requestId', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const actor = person(req);
    const reservation = await service.requestReservation(actor.id, id);
    const { status } = z.object({ status: z.enum(['accepted', 'refused']) }).parse(req.body);
    const requestId = uuid.safeParse(req.params.requestId);
    res.json(await service.updateRequest(actor.id, reservation, requestId, status));
  });
};
