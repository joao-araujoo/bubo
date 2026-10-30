import { describe, expect, it } from 'vitest';

import { BOOK_THICKNESS_MAX_PAGES, BOOK_THICKNESS_MIN_PAGES, bookThickness } from '../src';

describe('bookThickness', () => {
  it('uses a median thickness when the page count is unknown or invalid', () => {
    expect(bookThickness(null)).toBe(0.45);
    expect(bookThickness(undefined)).toBe(0.45);
    expect(bookThickness(0)).toBe(0.45);
    expect(bookThickness(-12)).toBe(0.45);
    expect(bookThickness(Number.NaN)).toBe(0.45);
  });

  it('never draws a book thinner than the minimum', () => {
    expect(bookThickness(1)).toBe(0.18);
    expect(bookThickness(BOOK_THICKNESS_MIN_PAGES)).toBe(0.18);
    expect(bookThickness(120)).toBe(0.18);
  });

  it('grows with the page count and caps at the maximum', () => {
    const short = bookThickness(200);
    const medium = bookThickness(400);
    const long = bookThickness(800);
    expect(short).toBeLessThan(medium);
    expect(medium).toBeLessThan(long);
    expect(long).toBeLessThan(1);
    expect(bookThickness(BOOK_THICKNESS_MAX_PAGES)).toBe(1);
    expect(bookThickness(20_000)).toBe(1);
  });
});
