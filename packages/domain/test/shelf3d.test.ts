import { describe, expect, it } from 'vitest';

import {
  SPINE_WIDTH_MAX,
  SPINE_WIDTH_MIN,
  packShelfRows,
  spineHeightRatio,
  spineWidth,
} from '../src';

describe('spineWidth', () => {
  it('stays within the spine range and grows with the page count', () => {
    expect(spineWidth(null)).toBeGreaterThan(SPINE_WIDTH_MIN);
    expect(spineWidth(null)).toBeLessThan(SPINE_WIDTH_MAX);
    expect(spineWidth(40)).toBeGreaterThanOrEqual(SPINE_WIDTH_MIN);
    expect(spineWidth(300)).toBeLessThan(spineWidth(700));
    expect(spineWidth(5_000)).toBe(SPINE_WIDTH_MAX);
  });
});

describe('spineHeightRatio', () => {
  it('is deterministic per title and stays within 0.82–1', () => {
    for (const title of ['Dom Casmurro', 'Torto Arado', 'A Hora da Estrela', 'Vidas Secas']) {
      const ratio = spineHeightRatio(title);
      expect(ratio).toBe(spineHeightRatio(title));
      expect(ratio).toBeGreaterThanOrEqual(0.82);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });
});

describe('packShelfRows', () => {
  const item = (id: string, width: number) => ({ item: id, width });

  it('fills rows left to right without exceeding the shelf width', () => {
    const rows = packShelfRows(
      [item('a', 40), item('b', 40), item('c', 40), item('d', 40), item('e', 40)],
      130,
      5,
    );
    expect(rows.map((row) => row.map((entry) => entry.item))).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('gives an oversized item its own row and keeps order', () => {
    const rows = packShelfRows([item('a', 30), item('wide', 200), item('b', 30)], 100, 4);
    expect(rows.map((row) => row.map((entry) => entry.item))).toEqual([['a'], ['wide'], ['b']]);
  });

  it('returns no rows for an empty shelf', () => {
    expect(packShelfRows([], 100, 4)).toEqual([]);
  });
});
