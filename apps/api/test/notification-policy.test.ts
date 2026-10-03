import { describe, expect, it } from 'vitest';

import {
  notificationMatchesUser,
  notificationPath,
} from '../../mobile/src/lib/notification-policy';
import { reviewReminderCopy } from '../src/services/notification-copy';

describe('notification routing and copy', () => {
  it('allows only complete product routes and blocks crafted destinations', () => {
    for (const path of [
      '/revisar',
      '/amigos',
      '/notificacoes',
      '/debates/club-1/post_1',
      '/resenhas/a/b',
      '/ciclos/club',
    ]) {
      expect(notificationPath(path)).toBe(path);
    }
    for (const path of [
      null,
      7,
      '/revisar-malicioso',
      '/amigos/extra',
      '/notificacoes?url=https://attacker.test',
      '/revisar#hash',
      '/debates/a',
      '/debates/a/b/c',
      '/ciclos/../amigos',
      '/ciclos/%2e%2e',
      '//attacker.test',
      'bubo://revisar',
    ]) {
      expect(notificationPath(path)).toBeNull();
    }
  });

  it('never opens a notification addressed to an earlier account', () => {
    expect(notificationMatchesUser({ userId: 'reader-a' }, 'reader-a')).toBe(true);
    expect(notificationMatchesUser({ userId: 'reader-a' }, 'reader-b')).toBe(false);
    expect(notificationMatchesUser({}, 'reader-a')).toBe(false);
    expect(notificationMatchesUser(null, 'reader-a')).toBe(false);
  });

  it('rotates curated playful reminders deterministically with accurate counts', () => {
    const input = { userId: 'reader-a', localDate: '2026-10-03', dueCount: 1 };
    expect(reviewReminderCopy(input)).toEqual(reviewReminderCopy(input));
    expect(reviewReminderCopy(input).body).toContain('1 lembrança para revisar.');
    expect(reviewReminderCopy({ ...input, dueCount: 5 }).body).toContain(
      '5 lembranças para revisar.',
    );
    const titles = new Set(
      Array.from(
        { length: 14 },
        (_, index) =>
          reviewReminderCopy({
            ...input,
            localDate: `2026-10-${String(index + 1).padStart(2, '0')}`,
          }).title,
      ),
    );
    expect(titles.size).toBeGreaterThan(3);
  });
});
