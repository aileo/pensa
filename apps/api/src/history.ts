import { z } from 'zod';
import type { HistoryEntry } from '../../../packages/contracts/src/index.js';

const historicalPerson = z
  .object({
    id: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    birthDate: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    birth_date: z.string().optional(),
  })
  .transform((p) => ({
    id: p.id,
    firstName: p.firstName ?? p.first_name,
    lastName: p.lastName ?? p.last_name,
    birthDate: p.birthDate ?? p.birth_date,
  }));
const snapshot = z.object({
  id: z.string(),
  title: z.string(),
  recipient: historicalPerson.nullish(),
  creator: historicalPerson.nullish(),
  participants: z.array(historicalPerson).default([]),
  occasions: z
    .array(
      z.object({
        name: z.string(),
        kind: z.enum(['fixed', 'birthday', 'name_day']).optional(),
        year: z.number(),
      }),
    )
    .default([]),
  giftedAt: z.string().nullish(),
});

export const historyEntry = (row: {
  id: string;
  recipient_id: string;
  snapshot: unknown;
  created_at: Date;
}): HistoryEntry => ({
  id: row.id,
  recipientId: row.recipient_id,
  created_at: row.created_at.toISOString(),
  snapshot: snapshot.parse(row.snapshot),
});
