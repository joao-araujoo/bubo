/**
 * Book recommendations as shortest paths on a taste graph (ADR-031).
 *
 * Nodes: the reader, their shelf books (seeds), features (authors and subjects) and candidate
 * books. Edges carry a strength in (0, 1]; their cost is -ln(strength), so Dijkstra's shortest
 * path from the reader is the strongest chain of evidence ("Mesma autoria de Duna"). Candidates
 * also link back to their features, so a book can be reached in two hops through another candidate.
 * Affinity is the best path combined (noisy-OR) with every direct overlap, then blended with the
 * candidate's popularity. Pure: callers fetch seeds and candidates and keep every claim honest.
 */
import { foldText } from './catalog';
import { type Genre } from './onboarding';
import { type ReadingStatus } from './reading';

export type RecommendSeed = {
  id: string;
  /** Null for interest-only seeds (onboarding genres). */
  title: string | null;
  authors: readonly string[];
  /** Raw subject strings (any language); normalized here. */
  subjects: readonly string[];
  /** Engagement in (0, 1]. */
  weight: number;
};

export type RecommendCandidate = {
  id: string;
  authors: readonly string[];
  subjects: readonly string[];
  /** Readers who logged the work at the source (popularity signal). */
  readers: number;
  /** Average rating 1–5 at the source, when known. */
  rating: number | null;
};

export type RecommendReason =
  | { kind: 'author'; seedId: string; author: string }
  | { kind: 'subject'; seedId: string; subject: string }
  | { kind: 'similar'; seedId: string; viaId: string };

export type Recommendation = {
  id: string;
  score: number;
  /** Strength of the taste evidence alone, in [0, 1]. */
  affinity: number;
  reason: RecommendReason;
};

/** How much a shelf status says about taste. Abandoned books are not taste evidence. */
export const SEED_STATUS_WEIGHT: Record<ReadingStatus, number> = {
  finished: 1,
  reading: 0.9,
  paused: 0.6,
  want_to_read: 0.55,
  abandoned: 0,
};

/** Onboarding interests weigh less than a real shelf book. */
export const INTEREST_SEED_WEIGHT = 0.45;

/** The canonical subject behind each onboarding genre. */
export const GENRE_SUBJECTS: Record<Genre, string> = {
  science_fiction: 'science fiction',
  philosophy: 'philosophy',
  fantasy: 'fantasy',
  psychology: 'psychology',
  history: 'history',
  business: 'business',
  technology: 'technology',
  biography: 'biography',
  science: 'science',
  mystery: 'mystery',
  self_care: 'self help',
};

/**
 * Portuguese labels for canonical subjects (reasons and section titles), in the order a reason
 * prefers them: specific genres first, broad shelves (classics, comics, adventure) last.
 */
export const SUBJECT_LABELS: Record<string, string> = {
  'science fiction': 'Ficção científica',
  fantasy: 'Fantasia',
  dystopia: 'Distopia',
  mystery: 'Mistério',
  thriller: 'Suspense',
  horror: 'Terror',
  romance: 'Romance',
  'historical fiction': 'Ficção histórica',
  'brazilian literature': 'Literatura brasileira',
  poetry: 'Poesia',
  philosophy: 'Filosofia',
  psychology: 'Psicologia',
  history: 'História',
  business: 'Negócios',
  technology: 'Tecnologia',
  biography: 'Biografia',
  science: 'Ciência',
  'self help': 'Autoajuda',
  'young adult': 'Jovem adulto',
  humor: 'Humor',
  adventure: 'Aventura',
  classics: 'Clássicos',
  'comics graphic novels': 'Quadrinhos',
};

/** The most telling labeled genre two subject lists share, or null. */
export function sharedGenreLabel(a: readonly string[], b: readonly string[]): string | null {
  const left = new Set(subjectSet(a));
  const right = new Set(subjectSet(b));
  const key = Object.keys(SUBJECT_LABELS).find(
    (subject) => left.has(subject) && right.has(subject),
  );
  return key ? (SUBJECT_LABELS[key] ?? null) : null;
}

type CanonRule = { subject: string; includes?: readonly string[]; exact?: readonly string[] };

/** First rule wins, so "science fiction" is checked before "science". */
const CANON_RULES: readonly CanonRule[] = [
  {
    subject: 'science fiction',
    includes: ['science fiction', 'ficcao cientifica', 'ciencia ficcion', 'sci fi'],
  },
  {
    subject: 'historical fiction',
    includes: ['historical fiction', 'ficcao historica', 'romance historico'],
  },
  {
    subject: 'fantasy',
    includes: ['fantasy', 'fantasia', 'fantastique', 'magic', 'dragons', 'wizards'],
  },
  { subject: 'dystopia', includes: ['dystopia', 'distopia'] },
  { subject: 'young adult', includes: ['young adult', 'juvenile fiction', 'jovem adulto'] },
  {
    subject: 'mystery',
    includes: ['mystery', 'mysteries', 'detective', 'misterio', 'policial', 'crime'],
  },
  { subject: 'thriller', includes: ['thriller', 'suspense'] },
  { subject: 'horror', includes: ['horror', 'terror', 'ghost stories'] },
  { subject: 'romance', includes: ['romance', 'love stories', 'romantic'] },
  { subject: 'comics graphic novels', includes: ['comic', 'graphic novel', 'quadrinhos', 'manga'] },
  { subject: 'poetry', includes: ['poetry', 'poesia', 'poems'] },
  { subject: 'brazilian literature', includes: ['brazilian', 'literatura brasileira', 'brasil'] },
  { subject: 'classics', includes: ['classic'] },
  {
    subject: 'self help',
    includes: ['self help', 'autoajuda', 'auto ajuda', 'personal growth', 'success', 'habits'],
  },
  { subject: 'philosophy', includes: ['philosophy', 'filosofia', 'stoic', 'ethics'] },
  { subject: 'psychology', includes: ['psychology', 'psicologia'] },
  { subject: 'biography', includes: ['biography', 'biografia', 'autobiography', 'memoir'] },
  {
    subject: 'business',
    includes: ['business', 'negocios', 'management', 'entrepreneur', 'finance', 'economics'],
  },
  {
    subject: 'technology',
    includes: ['technology', 'tecnologia', 'computer', 'programming', 'software'],
  },
  { subject: 'history', includes: ['history', 'historia'] },
  { subject: 'adventure', includes: ['adventure', 'aventura'] },
  { subject: 'humor', includes: ['humor', 'humorous'] },
  {
    subject: 'science',
    exact: [
      'science',
      'ciencia',
      'popular science',
      'physics',
      'biology',
      'astronomy',
      'chemistry',
    ],
  },
];

/** Library bookkeeping, formats and catch-alls that say nothing about taste. */
const STOP_SUBJECTS = new Set([
  'fiction',
  'general',
  'literature',
  'ficcion',
  'ficcao',
  'novela',
  'roman',
  'romans nouvelles',
  'novel',
  'novels',
  'accessible book',
  'protected daisy',
  'in library',
  'large type books',
  'large print',
  'lending library',
  'open library staff picks',
  'fiction in english',
  'english fiction',
  'american literature',
  'english literature',
  'history and criticism',
  'criticism and interpretation',
  'lectures et morceaux choisis',
  'study guides',
  'textbooks',
  'readers',
  'new york times bestseller',
  'new york times reviewed',
  'bestsellers',
  'long now manual for civilization',
  'juvenile literature',
  'children s fiction',
  'translations',
  'internet archive wishlist',
]);
const STOP_PREFIXES = ['nyt ', 'award ', 'reading level', 'translations into', 'collectionid'];

/**
 * Raw subject → normalized subjects: the canonical genre it names (if any) and the specific phrase
 * itself (e.g. "dune imaginary place" ties a series together). Catch-alls are dropped.
 */
export function normalizeSubject(raw: string): string[] {
  const out = new Set<string>();
  for (const part of raw.split(/,|--|\/|;|\|/)) {
    const folded = foldText(part);
    if (folded.length < 3 || folded.length > 60) continue;
    if (STOP_SUBJECTS.has(folded) || STOP_PREFIXES.some((prefix) => folded.startsWith(prefix))) {
      continue;
    }
    if (/\b(langue|language|lingua)\b/.test(folded)) continue;
    const words = ` ${folded} `;
    const canon = CANON_RULES.find(
      (rule) =>
        rule.includes?.some((needle) => words.includes(` ${needle}`)) ||
        rule.exact?.includes(folded),
    );
    if (canon) out.add(canon.subject);
    // A plain translation of the genre ("Fantasia") adds nothing beyond the genre itself.
    const synonym = canon && [canon.subject, ...(canon.includes ?? [])].includes(folded);
    if (!synonym) out.add(folded);
  }
  return [...out];
}

/** Normalized subjects of a book, capped so a long subject list cannot dominate. */
export function subjectSet(raw: readonly string[], max = 40): string[] {
  const out = new Set<string>();
  for (const subject of raw) {
    for (const value of normalizeSubject(subject)) {
      if (out.size >= max) return [...out];
      out.add(value);
    }
  }
  return [...out];
}

export function isCanonicalSubject(subject: string): boolean {
  return CANON_RULES.some((rule) => rule.subject === subject);
}

const authorNode = (name: string) => `a:${foldText(name)}`;
const subjectNode = (subject: string) => `s:${subject}`;

/** Edge strengths (probabilities): authorship is the strongest single signal. */
const AUTHOR_STRENGTH = 0.85;
const SUBJECT_STRENGTH = 0.6;
/** Leaving a candidate to reach another one costs more than leaving a seed. */
const HOP_DAMPING = 0.5;
const MIN_SPECIFICITY = 0.15;

type Edge = { to: string; strength: number };

/** Minimal binary heap for Dijkstra. */
class MinHeap {
  private readonly items: { node: string; cost: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(node: string, cost: number) {
    const items = this.items;
    items.push({ node, cost });
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      const up = items[parent];
      const current = items[index];
      if (!up || !current || up.cost <= current.cost) break;
      items[parent] = current;
      items[index] = up;
      index = parent;
    }
  }
  pop(): { node: string; cost: number } | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (!top || !last || items.length === 0) return top;
    items[0] = last;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if ((items[left]?.cost ?? Infinity) < (items[smallest]?.cost ?? Infinity)) smallest = left;
      if ((items[right]?.cost ?? Infinity) < (items[smallest]?.cost ?? Infinity)) smallest = right;
      if (smallest === index) break;
      const a = items[index];
      const b = items[smallest];
      if (!a || !b) break;
      items[index] = b;
      items[smallest] = a;
      index = smallest;
    }
    return top;
  }
}

/** Single-source shortest paths (costs = -ln(strength) ≥ 0). Returns distance and predecessor. */
export function shortestPaths(
  graph: ReadonlyMap<string, readonly Edge[]>,
  source: string,
): { distance: Map<string, number>; previous: Map<string, string> } {
  const distance = new Map<string, number>([[source, 0]]);
  const previous = new Map<string, string>();
  const done = new Set<string>();
  const heap = new MinHeap();
  heap.push(source, 0);
  while (heap.size) {
    const current = heap.pop();
    if (!current || done.has(current.node)) continue;
    done.add(current.node);
    for (const edge of graph.get(current.node) ?? []) {
      if (edge.strength <= 0) continue;
      const cost = current.cost - Math.log(Math.min(1, edge.strength));
      if (cost < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, cost);
        previous.set(edge.to, current.node);
        heap.push(edge.to, cost);
      }
    }
  }
  return { distance, previous };
}

const noisyOr = (values: readonly number[]) => 1 - values.reduce((acc, v) => acc * (1 - v), 1);

/**
 * Ranks candidates for a reader. Candidates with no path from any seed are left out (they belong
 * in popularity lists, not "Para você"). At most `perAuthor` books per first author.
 */
export function recommendBooks(
  seeds: readonly RecommendSeed[],
  candidates: readonly RecommendCandidate[],
  options: { limit?: number; perAuthor?: number } = {},
): Recommendation[] {
  const limit = options.limit ?? 30;
  const perAuthor = options.perAuthor ?? 2;
  const usableSeeds = seeds.filter((seed) => seed.weight > 0);
  if (!usableSeeds.length || !candidates.length) return [];

  const seedSubjects = new Map(usableSeeds.map((seed) => [seed.id, subjectSet(seed.subjects)]));
  const candidateSubjects = new Map(candidates.map((c) => [c.id, subjectSet(c.subjects)]));

  // Specificity (IDF over every book in play): rare shared subjects are stronger evidence.
  const documents = [...seedSubjects.values(), ...candidateSubjects.values()];
  const frequency = new Map<string, number>();
  for (const subjects of documents) {
    for (const subject of subjects) frequency.set(subject, (frequency.get(subject) ?? 0) + 1);
  }
  const maxIdf = Math.log(1 + documents.length);
  const specificity = (subject: string) =>
    Math.max(
      MIN_SPECIFICITY,
      Math.log(1 + documents.length / (frequency.get(subject) ?? 1)) / maxIdf,
    );

  const graph = new Map<string, Edge[]>();
  const link = (from: string, to: string, strength: number) => {
    const list = graph.get(from) ?? [];
    list.push({ to, strength });
    graph.set(from, list);
  };

  for (const seed of usableSeeds) {
    const node = `seed:${seed.id}`;
    link('reader', node, Math.min(1, seed.weight));
    for (const author of seed.authors) link(node, authorNode(author), AUTHOR_STRENGTH);
    for (const subject of seedSubjects.get(seed.id) ?? []) {
      link(node, subjectNode(subject), SUBJECT_STRENGTH * specificity(subject));
    }
  }
  for (const candidate of candidates) {
    const node = `book:${candidate.id}`;
    for (const author of candidate.authors) {
      link(authorNode(author), node, AUTHOR_STRENGTH);
      link(node, authorNode(author), AUTHOR_STRENGTH * HOP_DAMPING);
    }
    for (const subject of candidateSubjects.get(candidate.id) ?? []) {
      const strength = SUBJECT_STRENGTH * specificity(subject);
      link(subjectNode(subject), node, strength);
      link(node, subjectNode(subject), strength * HOP_DAMPING);
    }
  }

  const { distance, previous } = shortestPaths(graph, 'reader');

  // Strongest single reach of each feature straight from a seed (for direct overlap evidence).
  const featureReach = new Map<string, number>();
  for (const seed of usableSeeds) {
    for (const edge of graph.get(`seed:${seed.id}`) ?? []) {
      const reach = Math.min(1, seed.weight) * edge.strength;
      if (reach > (featureReach.get(edge.to) ?? 0)) featureReach.set(edge.to, reach);
    }
  }

  const maxReaders = Math.max(1, ...candidates.map((c) => c.readers));
  const scored: Recommendation[] = [];
  for (const candidate of candidates) {
    const node = `book:${candidate.id}`;
    const cost = distance.get(node);
    if (cost === undefined) continue;
    const reason = explain(node, previous);
    if (!reason) continue;
    const direct = (graph.get(node) ?? []).map((edge) => {
      const reach = featureReach.get(edge.to) ?? 0;
      return reach * (edge.strength / HOP_DAMPING);
    });
    const affinity = Math.min(1, Math.max(Math.exp(-cost), noisyOr(direct)));
    const popularity = Math.log(1 + Math.max(0, candidate.readers)) / Math.log(1 + maxReaders);
    const quality = candidate.rating ? Math.max(0, Math.min(1, (candidate.rating - 3) / 2)) : 0;
    scored.push({
      id: candidate.id,
      affinity,
      score: 0.7 * affinity + 0.25 * popularity + 0.05 * quality,
      reason,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const firstAuthor = new Map(candidates.map((c) => [c.id, foldText(c.authors[0] ?? c.id)]));
  const perAuthorCount = new Map<string, number>();
  const picked: Recommendation[] = [];
  for (const recommendation of scored) {
    const author = firstAuthor.get(recommendation.id) ?? recommendation.id;
    const count = perAuthorCount.get(author) ?? 0;
    if (count >= perAuthor) continue;
    perAuthorCount.set(author, count + 1);
    picked.push(recommendation);
    if (picked.length >= limit) break;
  }
  return picked;
}

/** Walks the shortest path back to the seed it started from: that seed explains the book. */
function explain(node: string, previous: ReadonlyMap<string, string>): RecommendReason | null {
  const path: string[] = [node];
  let current = node;
  while (previous.has(current)) {
    current = previous.get(current) ?? '';
    path.unshift(current);
  }
  // reader → seed:x → feature → (book:y → feature →)* book:z
  const seed = path[1];
  const feature = path[2];
  if (!seed?.startsWith('seed:') || !feature) return null;
  const seedId = seed.slice('seed:'.length);
  const via = path.slice(3, -1).find((step) => step.startsWith('book:'));
  if (via) return { kind: 'similar', seedId, viaId: via.slice('book:'.length) };
  if (feature.startsWith('a:')) return { kind: 'author', seedId, author: feature.slice(2) };
  return { kind: 'subject', seedId, subject: feature.slice(2) };
}

/**
 * Subjects that best describe a reader, for fetching candidates: summed seed weight, shared ones
 * first, canonical genres preferred on ties (they match library subject indexes best).
 */
export function topSeedSubjects(seeds: readonly RecommendSeed[], max = 5): string[] {
  const weight = new Map<string, number>();
  for (const seed of seeds) {
    if (seed.weight <= 0) continue;
    for (const subject of subjectSet(seed.subjects)) {
      weight.set(subject, (weight.get(subject) ?? 0) + seed.weight);
    }
  }
  return [...weight.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        Number(isCanonicalSubject(b[0])) - Number(isCanonicalSubject(a[0])) ||
        a[0].localeCompare(b[0]),
    )
    .slice(0, max)
    .map(([subject]) => subject);
}
