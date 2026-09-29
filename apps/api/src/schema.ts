import { pgTable, uuid, text, timestamp, date, boolean, integer, numeric, uniqueIndex, index, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const id = () => uuid('id').primaryKey().defaultRandom();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const households = pgTable('households', { id: id(), name: text('name').notNull() });
export const users = pgTable('users', {
  id: id(), householdId: uuid('household_id').notNull().references(() => households.id),
  firstName: text('first_name').notNull(), lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(), passwordHash: text('password_hash').notNull(),
  birthDate: date('birth_date').notNull(), nameDay: text('name_day'), avatar: text('avatar'), householdAdmin: boolean('household_admin').notNull().default(false),
});
export const families = pgTable('families', { id: id(), name: text('name').notNull() });
export const memberships = pgTable('memberships', {
  familyId: uuid('family_id').notNull().references(() => families.id),
  householdId: uuid('household_id').notNull().references(() => households.id),
}, t => [primaryKey({ columns: [t.familyId, t.householdId] })]);
export const familyAdmins = pgTable('family_admins', {
  familyId: uuid('family_id').notNull().references(() => families.id),
  userId: uuid('user_id').notNull().references(() => users.id),
}, t => [primaryKey({ columns: [t.familyId, t.userId] })]);
export const sessions = pgTable('sessions', { tokenHash: text('token_hash').primaryKey(), userId: uuid('user_id').notNull().references(() => users.id), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull() });
export const invitations = pgTable('invitations', {
  tokenHash: text('token_hash').primaryKey(), householdId: uuid('household_id').notNull().references(() => households.id),
  email: text('email'), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});
export const occasions = pgTable('occasions', {
  id: id(), familyId: uuid('family_id').notNull().references(() => families.id),
  name: text('name').notNull(), kind: text('kind').notNull(),
  month: integer('month'), day: integer('day'),
});
export const wishes = pgTable('wishes', {
  id: id(), ownerId: uuid('owner_id').notNull().references(() => users.id),
  title: text('title').notNull(), description: text('description'), url: text('url').notNull(),
  image: text('image').notNull(), price: numeric('price', { precision: 12, scale: 2 }),
  tags: text('tags').array().notNull().default([]), position: integer('position').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }), giftedAt: timestamp('gifted_at', { withTimezone: true }),
  createdAt: created(),
});
export const reservations = pgTable('reservations', {
  id: id(), wishId: uuid('wish_id').notNull().references(() => wishes.id), creatorId: uuid('creator_id').notNull().references(() => users.id),
  status: text('status').notNull().default('reserved'), openToContributions: boolean('open_to_contributions').notNull().default(false),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }), createdAt: created(),
}, t => [uniqueIndex('one_active_reservation').on(t.wishId).where(sql`${t.cancelledAt} IS NULL`), index('reservation_creator').on(t.creatorId)]);
export const reservationOccasions = pgTable('reservation_occasions', {
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id),
  occasionId: uuid('occasion_id').notNull().references(() => occasions.id),
  year: integer('year').notNull(),
}, t => [primaryKey({ columns: [t.reservationId, t.occasionId, t.year] })]);
export const participants = pgTable('participants', {
  reservationId: uuid('reservation_id').notNull().references(() => reservations.id),
  userId: uuid('user_id').notNull().references(() => users.id),
}, t => [primaryKey({ columns: [t.reservationId, t.userId] })]);
export const requests = pgTable('requests', {
  id: id(), reservationId: uuid('reservation_id').notNull().references(() => reservations.id),
  userId: uuid('user_id').notNull().references(() => users.id), status: text('status').notNull().default('pending'),
}, t => [uniqueIndex('one_request_per_user').on(t.reservationId, t.userId)]);
export const history = pgTable('history', {
  id: id(), reservationId: uuid('reservation_id').notNull().unique().references(() => reservations.id),
  recipientId: uuid('recipient_id').notNull().references(() => users.id), snapshot: jsonb('snapshot').notNull(), createdAt: created(),
});
