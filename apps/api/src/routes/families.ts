import type { Router } from 'express';
import { z } from 'zod';
import type { RouteDeps } from '../app.js';
import { createFamilyService } from '../services/families.js';

// Some endpoints historically authorize before reporting malformed bodies. Keep that error
// precedence without repeating authorization on successful service calls.
const parseAuthorized = async <T extends z.ZodType>(
  schema: T,
  body: unknown,
  authorize: () => Promise<void>,
): Promise<z.output<T>> => {
  const result = schema.safeParse(body);
  if (!result.success) {
    await authorize();
    throw result.error;
  }
  return result.data;
};

export const registerFamilyRoutes = (api: Router, deps: RouteDeps) => {
  const { person, uuid, nameDay, occasionData } = deps;
  const service = createFamilyService(deps);
  const nameInput = z.object({ name: z.string().trim().min(1).max(100) });
  const memberInput = z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    birthDate: z.iso.date(),
    nameDay: nameDay.nullish(),
    avatar: z.string().trim().max(500).nullish(),
  });
  const memberUpdateInput = z.object({
    admin: z.boolean().optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    birthDate: z.iso.date().optional(),
    nameDay: nameDay.nullish(),
    avatar: z.string().trim().max(500).nullish(),
  });
  const accountInput = z.object({
    email: z.email().toLowerCase(),
    password: z.string().min(12).max(128),
  });
  const householdInvitationInput = z.object({ email: z.email().optional() });
  const joinInput = z.object({ code: z.string().min(1).max(128) });
  const adminInput = z.object({ userId: uuid });

  api.get('/users', async (req, res) => {
    res.json(await service.listUsers(person(req)));
  });
  api.get('/households', async (req, res) => {
    res.json(await service.listHouseholds(person(req)));
  });
  api.get('/households/mine', async (req, res) => {
    res.json(await service.getOwnHousehold(person(req)));
  });
  api.post('/households/:id/members', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const actor = person(req);
    const data = await parseAuthorized(memberInput, req.body, () =>
      service.authorizeOwnHouseholdAdmin(actor, id),
    );
    res.status(201).json(await service.createMember(actor, id, data));
  });
  api.patch('/households/:id/members/:userId', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    const actor = person(req);
    const data = await parseAuthorized(memberUpdateInput, req.body, () =>
      service.authorizeOwnHouseholdAdmin(actor, id),
    );
    res.json(await service.updateMember(actor, id, userId, data));
  });
  api.delete('/households/:id/members/:userId', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    res.json(await service.deleteMember(person(req), id, userId));
  });
  api.post('/households/:id/members/:userId/invitations', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    res.status(201).json(await service.createMemberInvitation(person(req), id, userId));
  });
  api.post('/households/:id/members/:userId/account', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    const actor = person(req);
    const data = await parseAuthorized(accountInput, req.body, () =>
      service.authorizeOwnHouseholdAdmin(actor, id),
    );
    res.json(await service.createMemberAccount(actor, id, userId, data));
  });
  api.post('/households/:id/members/:userId/move-out', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = uuid.parse(req.params.userId);
    res.json(await service.moveMemberOut(person(req), id, userId));
  });
  api.patch('/households/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      data = nameInput.parse(req.body);
    res.json(await service.updateHousehold(person(req), id, data));
  });
  api.post('/households/:id/invitations', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const actor = person(req);
    const data = await parseAuthorized(householdInvitationInput, req.body, () =>
      service.authorizeHouseholdInvitation(actor, id),
    );
    res.status(201).json(await service.createHouseholdInvitation(actor, id, data));
  });
  api.get('/families', async (req, res) => {
    res.json(await service.listFamilies(person(req)));
  });
  api.post('/families', async (req, res) => {
    const actor = person(req);
    const data = await parseAuthorized(nameInput, req.body, () => service.authorizeHouseholdAdmin(actor));
    res.status(201).json(await service.createFamily(actor, data));
  });
  api.patch('/families/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const actor = person(req);
    const data = await parseAuthorized(nameInput, req.body, () => service.authorizeFamilyAdmin(actor, id));
    res.json(await service.updateFamily(actor, id, data));
  });
  api.post('/families/:id/invitations', async (req, res) => {
    const id = uuid.parse(req.params.id);
    res.status(201).json(await service.createFamilyInvitation(person(req), id));
  });
  api.post('/families/join', async (req, res) => {
    const actor = person(req);
    const data = await parseAuthorized(joinInput, req.body, () => service.authorizeHouseholdAdmin(actor));
    res.status(201).json(await service.joinFamily(actor, data));
  });
  api.delete('/families/:id/households/:householdId', async (req, res) => {
    const id = uuid.parse(req.params.id),
      householdId = uuid.parse(req.params.householdId);
    res.json(await service.removeFamilyHousehold(person(req), id, householdId));
  });
  api.post('/families/:id/admins', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const actor = person(req);
    const data = await parseAuthorized(adminInput, req.body, () => service.authorizeFamilyAdmin(actor, id));
    res.status(201).json(await service.addFamilyAdmin(actor, id, data));
  });
  api.get('/occasions', async (req, res) => {
    const actor = person(req);
    const recipientId = uuid.parse(req.query.recipientId ?? actor.id);
    res.json(await service.listOccasions(actor, recipientId));
  });
  api.post('/families/:id/occasions', async (req, res) => {
    const id = uuid.parse(req.params.id);
    const actor = person(req);
    const data = await parseAuthorized(occasionData, req.body, () => service.authorizeFamilyAdmin(actor, id));
    res.status(201).json(await service.createOccasion(actor, id, data));
  });
  api.patch('/occasions/:id', async (req, res) => {
    const id = uuid.parse(req.params.id),
      data = occasionData.parse(req.body);
    res.json(await service.updateOccasion(person(req), id, data));
  });
  api.delete('/occasions/:id', async (req, res) => {
    const id = uuid.parse(req.params.id);
    res.json(await service.deleteOccasion(person(req), id));
  });
};
