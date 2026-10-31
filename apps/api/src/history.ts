import { z } from 'zod';
import type { HistoryEntry } from '../../../packages/contracts/src/index.js';

const historicalPerson = z
  .object({
    id: z.string(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    birthDate: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    birth_date: z.string().nullish(),
  })
  .transform((p) => ({
    id: p.id,
    firstName: p.firstName ?? p.first_name ?? undefined,
    lastName: p.lastName ?? p.last_name ?? undefined,
    birthDate: p.birthDate ?? p.birth_date ?? undefined,
  }));
const snapshot = z.object({
  id: z.string(),
  title: z.string().nullish(),
  recipient: historicalPerson.nullish(),
  creator: historicalPerson.nullish(),
  participants: z
    .array(historicalPerson)
    .nullish()
    .transform((people) => people ?? []),
  occasions: z
    .array(
      z.object({
        name: z.string(),
        kind: z
          .enum(['fixed', 'birthday', 'name_day'])
          .nullish()
          .transform((kind) => kind ?? undefined),
        year: z
          .number()
          .nullish()
          .transform((year) => year ?? undefined),
      }),
    )
    .nullish()
    .transform((occasions) => occasions ?? []),
  giftedAt: z.iso.datetime({ offset: true }).nullish(),
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
