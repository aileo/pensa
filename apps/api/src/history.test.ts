import { describe, expect, it } from 'vitest';
import { historyEntry } from './history.js';

const row = {
  id: 'history',
  recipient_id: 'recipient',
  created_at: new Date('2026-10-31T09:00:00Z'),
};

describe('public history snapshots', () => {
  it('normalizes legacy identities and strips private snapshot fields', () => {
    const person = {
      id: 'recipient',
      first_name: 'Legacy',
      last_name: 'Name',
      birth_date: '2000-01-01',
      email: 'private@example.test',
      household_id: 'private',
      password_hash: 'private',
      name_day: 'private',
      household_admin: true,
    };
    expect(
      historyEntry({
        ...row,
        snapshot: {
          id: 'gift',
          title: 'A gift',
          recipient: person,
          creator: person,
          participants: [person],
          occasions: [{ name: 'Noël', year: 2025, private: true }],
          description: 'private',
          giftedAt: '2026-10-30T12:00:00.000Z',
        },
      }),
    ).toEqual({
      id: 'history',
      recipientId: 'recipient',
      created_at: '2026-10-31T09:00:00.000Z',
      snapshot: {
        id: 'gift',
        title: 'A gift',
        recipient: {
          id: 'recipient',
          firstName: 'Legacy',
          lastName: 'Name',
          birthDate: '2000-01-01',
        },
        creator: {
          id: 'recipient',
          firstName: 'Legacy',
          lastName: 'Name',
          birthDate: '2000-01-01',
        },
        participants: [
          {
            id: 'recipient',
            firstName: 'Legacy',
            lastName: 'Name',
            birthDate: '2000-01-01',
          },
        ],
        occasions: [{ name: 'Noël', year: 2025 }],
        giftedAt: '2026-10-30T12:00:00.000Z',
      },
    });
  });

  it('preserves modern names and leaves unavailable context absent', () => {
    const entry = historyEntry({
      ...row,
      snapshot: {
        id: 'gift',
        recipient: {
          id: 'recipient',
          firstName: 'Modern',
          first_name: 'Old',
          lastName: 'Name',
        },
      },
    });
    expect(entry.snapshot.recipient).toMatchObject({
      firstName: 'Modern',
      lastName: 'Name',
    });
    expect(entry.snapshot.creator).toBeUndefined();
    expect(entry.snapshot.title).toBeUndefined();
    expect(entry.snapshot.giftedAt).toBeUndefined();
    expect(entry.snapshot.participants).toEqual([]);
    expect(entry.snapshot.occasions).toEqual([]);
    expect(
      historyEntry({
        ...row,
        snapshot: {
          id: 'gift',
          title: null,
          recipient: null,
          creator: null,
          participants: null,
          occasions: null,
          giftedAt: null,
        },
      }).snapshot,
    ).toMatchObject({
      recipient: null,
      creator: null,
      participants: [],
      occasions: [],
      giftedAt: null,
    });
  });

  it('does not fabricate missing occasion years or birthdays', () => {
    expect(
      historyEntry({
        ...row,
        snapshot: {
          id: 'gift',
          recipient: { id: 'recipient', birth_date: null },
          occasions: [{ name: 'Birthday', kind: 'birthday' }],
        },
      }).snapshot,
    ).toMatchObject({
      recipient: { birthDate: undefined },
      occasions: [{ name: 'Birthday', kind: 'birthday' }],
    });
    expect(
      historyEntry({
        ...row,
        snapshot: {
          id: 'gift',
          occasions: [{ name: 'Legacy occasion', kind: null, year: null }],
        },
      }).snapshot.occasions,
    ).toEqual([{ name: 'Legacy occasion', kind: undefined, year: undefined }]);
  });

  it('rejects malformed required snapshot data rather than returning a fake gift', () => {
    expect(() => historyEntry({ ...row, snapshot: {} })).toThrow();
    expect(() =>
      historyEntry({
        ...row,
        snapshot: { id: 'gift', giftedAt: 'not a date' },
      }),
    ).toThrow();
  });
});
