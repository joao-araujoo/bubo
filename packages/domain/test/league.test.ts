import { describe, expect, it } from 'vitest';

import { buildLeagueStandings, leagueWeek, rankByXp } from '../src';

describe('weekly league', () => {
  it('counts the days left in the Monday→Sunday week, today included', () => {
    expect(leagueWeek('2026-09-28')).toEqual({
      weekStart: '2026-09-28',
      weekEnd: '2026-10-04',
      daysLeft: 7,
    });
    expect(leagueWeek('2026-10-01').daysLeft).toBe(4);
    expect(leagueWeek('2026-10-04').daysLeft).toBe(1);
  });

  it('ranks by XP with stable, distinct positions', () => {
    const ranked = rankByXp(
      [
        { id: 'b', name: 'Bia' },
        { id: 'a', name: 'Ana' },
        { id: 'c', name: 'Ana' },
      ],
      (row) => (row.id === 'b' ? 10 : 5),
    );
    expect(ranked.map((row) => [row.id, row.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ]);
  });

  it('reports the real movement since yesterday and nothing on Monday', () => {
    const participants = [
      { id: 'me', name: 'Eu', me: true, xpBefore: 10, xp: 60 },
      { id: 'f1', name: 'Rui', me: false, xpBefore: 40, xp: 40 },
      { id: 'f2', name: 'Lia', me: false, xpBefore: 80, xp: 90 },
    ];
    const standings = buildLeagueStandings({ today: '2026-10-01', participants });
    expect(standings.me).toEqual({ rank: 2, previousRank: 3, weeklyXp: 60 });
    expect(standings.entries.map((entry) => entry.name)).toEqual(['Lia', 'Eu', 'Rui']);
    expect(standings.daysLeft).toBe(4);
    expect(buildLeagueStandings({ today: '2026-09-28', participants }).me.previousRank).toBeNull();
  });

  it('works for a reader without friends', () => {
    const standings = buildLeagueStandings({
      today: '2026-10-01',
      participants: [{ id: 'me', name: 'Eu', me: true, xpBefore: 0, xp: 0 }],
    });
    expect(standings.me).toEqual({ rank: 1, previousRank: 1, weeklyXp: 0 });
    expect(standings.entries).toHaveLength(1);
  });
});
