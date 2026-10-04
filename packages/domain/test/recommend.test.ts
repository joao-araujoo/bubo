import { describe, expect, it } from 'vitest';

import {
  coverUrlForWidth,
  normalizeSubject,
  type RecommendCandidate,
  recommendBooks,
  type RecommendSeed,
  sharedGenreLabel,
  shortestPaths,
  subjectSet,
  topSeedSubjects,
} from '../src';

const dune: RecommendSeed = {
  id: 'dune',
  title: 'Duna',
  authors: ['Frank Herbert'],
  subjects: ['Fiction, science fiction, general', 'Dune (Imaginary place)', 'Fiction'],
  weight: 1,
};

const candidate = (
  id: string,
  authors: string[],
  subjects: string[],
  readers = 100,
): RecommendCandidate => ({ id, authors, subjects, readers, rating: null });

describe('normalizeSubject', () => {
  it('maps genres across languages and drops catch-alls and bookkeeping', () => {
    expect(normalizeSubject('Fiction, science fiction, general')).toEqual(['science fiction']);
    expect(normalizeSubject('Ficção científica')).toContain('science fiction');
    expect(normalizeSubject('Science-fiction américaine')).toContain('science fiction');
    expect(normalizeSubject('Fantasia')).toEqual(['fantasy']);
    expect(normalizeSubject('Dune (Imaginary place)')).toEqual(['dune imaginary place']);
    for (const noise of [
      'Fiction',
      'Accessible book',
      'Protected DAISY',
      'nyt:mass-market-monthly=2021-11-07',
      'award:nebula_award=novel',
      'Reading Level-Grade 7',
      'Anglais (langue)',
      'Translations into Russian',
    ]) {
      expect(normalizeSubject(noise)).toEqual([]);
    }
  });

  it('does not read "science fiction" as plain science', () => {
    expect(subjectSet(['Science fiction'])).toEqual(['science fiction']);
    expect(subjectSet(['Science'])).toEqual(['science']);
  });
});

describe('shortestPaths', () => {
  it('prefers the strongest chain of evidence over the fewest hops', () => {
    const graph = new Map([
      [
        'r',
        [
          { to: 'a', strength: 0.1 },
          { to: 'b', strength: 0.9 },
        ],
      ],
      ['b', [{ to: 'a', strength: 0.9 }]],
    ]);
    const { distance, previous } = shortestPaths(graph, 'r');
    expect(previous.get('a')).toBe('b');
    expect(distance.get('a')).toBeCloseTo(-2 * Math.log(0.9));
  });
});

describe('recommendBooks', () => {
  it('ranks books close to the shelf above popular unrelated ones and explains why', () => {
    const recommendations = recommendBooks(
      [dune],
      [
        candidate('messiah', ['Frank Herbert'], ['Science fiction', 'Dune (Imaginary place)'], 800),
        candidate('foundation', ['Isaac Asimov'], ['Science fiction', 'Galactic empire'], 3000),
        candidate('romance', ['Colleen Hoover'], ['Romance', 'Love stories'], 40000),
      ],
    );
    expect(recommendations.map((r) => r.id)).toEqual(['messiah', 'foundation']);
    expect(recommendations[0]?.reason).toEqual({
      kind: 'author',
      seedId: 'dune',
      author: 'frank herbert',
    });
    expect(recommendations[1]?.reason).toMatchObject({ kind: 'subject', seedId: 'dune' });
  });

  it('reaches books two hops away through another candidate', () => {
    const [direct, twoHops] = recommendBooks(
      [{ ...dune, subjects: [] }],
      [
        candidate('messiah', ['Frank Herbert'], ['Space opera']),
        candidate('hyperion', ['Dan Simmons'], ['Space opera']),
      ],
    );
    expect(direct?.id).toBe('messiah');
    expect(twoHops).toMatchObject({
      id: 'hyperion',
      reason: { kind: 'similar', seedId: 'dune', viaId: 'messiah' },
    });
  });

  it('rewards several shared subjects and rarer ones', () => {
    const seed: RecommendSeed = {
      id: 's',
      title: 'O Hobbit',
      authors: ['J.R.R. Tolkien'],
      subjects: ['Fantasy', 'Dragons', 'Dwarves'],
      weight: 1,
    };
    const ranked = recommendBooks(
      [seed],
      [
        candidate('one', ['A'], ['Fantasy'], 100),
        candidate('many', ['B'], ['Fantasy', 'Dwarves', 'Elves'], 100),
      ],
    );
    expect(ranked.map((r) => r.id)).toEqual(['many', 'one']);
    expect(ranked[0]?.affinity).toBeGreaterThan(ranked[1]?.affinity ?? 1);
  });

  it('ignores abandoned books, caps books per author and handles empty input', () => {
    expect(
      recommendBooks([{ ...dune, weight: 0 }], [candidate('x', ['Frank Herbert'], [])]),
    ).toEqual([]);
    expect(recommendBooks([], [candidate('x', ['A'], [])])).toEqual([]);
    const capped = recommendBooks(
      [dune],
      ['a', 'b', 'c'].map((id) => candidate(id, ['Frank Herbert'], [])),
      { perAuthor: 2 },
    );
    expect(capped).toHaveLength(2);
  });

  it('is deterministic', () => {
    const candidates = [
      candidate('b', ['X'], ['Science fiction']),
      candidate('a', ['Y'], ['Science fiction']),
    ];
    expect(recommendBooks([dune], candidates).map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('topSeedSubjects', () => {
  it('orders by summed engagement and prefers canonical genres on ties', () => {
    expect(
      topSeedSubjects([
        dune,
        { ...dune, id: 'b', subjects: ['Science fiction'], weight: 0.5 },
        { ...dune, id: 'c', subjects: ['Fantasy'], weight: 0 },
      ]),
    ).toEqual(['science fiction', 'dune imaginary place']);
  });
});

describe('sharedGenreLabel', () => {
  it('names the most telling shared genre, broad shelves last', () => {
    expect(
      sharedGenreLabel(['Fantasy', 'Comics & Graphic Novels'], ['Graphic novels', 'Fantasia']),
    ).toBe('Fantasia');
    expect(sharedGenreLabel(['Classics', 'Comics'], ['Classic literature', 'Comic books'])).toBe(
      'Clássicos',
    );
    expect(sharedGenreLabel(['Adultery'], ['Space opera'])).toBeNull();
  });
});

describe('coverUrlForWidth', () => {
  it('asks for smaller renditions for small covers only', () => {
    const ol = 'https://covers.openlibrary.org/b/id/1-L.jpg?default=false';
    expect(coverUrlForWidth(ol, 76)).toBe(
      'https://covers.openlibrary.org/b/id/1-M.jpg?default=false',
    );
    expect(coverUrlForWidth(ol, 176)).toBe(ol);
    const google = 'https://books.google.com/books/content?id=x&zoom=1&fife=w400-h600';
    expect(coverUrlForWidth(google, 60)).toContain('fife=w200-h300');
    expect(coverUrlForWidth('https://media.example/covers/a', 60)).toBe(
      'https://media.example/covers/a',
    );
  });
});
