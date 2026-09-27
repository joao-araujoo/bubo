import { describe, expect, it } from 'vitest';

import {
  coverCandidates,
  foldText,
  hardenCoverUrl,
  isCatalogId,
  openLibraryIsbnCover,
  parsePublishedYear,
  stableBucket,
  titleInitials,
  workMatchKey,
} from '../src';

describe('catalog ids', () => {
  it('accepts the three id kinds and rejects anything else', () => {
    expect(isCatalogId('isbn:9788576573135')).toBe(true);
    expect(isCatalogId('gb:zyTCAlFPjgYC')).toBe(true);
    expect(isCatalogId('ol:OL45804W')).toBe(true);
    expect(isCatalogId('isbn:1234567890123')).toBe(false);
    expect(isCatalogId('ol:OL1M')).toBe(true);
    expect(isCatalogId('gb:../../etc')).toBe(false);
    expect(isCatalogId('https://evil.example')).toBe(false);
  });
});

describe('matching', () => {
  it('folds accents, case and punctuation', () => {
    expect(foldText('  Memórias Póstumas de Brás Cubas! ')).toBe('memorias postumas de bras cubas');
  });

  it('collapses editions of the same work', () => {
    expect(workMatchKey('Duna: Livro 1', ['Frank Herbert'])).toBe(
      workMatchKey('Duna', ['FRANK HERBERT']),
    );
    expect(workMatchKey('O Hobbit', ['J. R. R. Tolkien'])).toBe(
      workMatchKey('Hobbit', ['J.R.R. Tolkien']),
    );
    expect(workMatchKey('Duna', ['Frank Herbert'])).not.toBe(
      workMatchKey('Duna', ['Outra Pessoa']),
    );
  });
});

describe('covers', () => {
  it('forces https, flattens Google thumbnails and asks for a larger image', () => {
    const url = hardenCoverUrl(
      'http://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api',
    );
    expect(url).toMatch(/^https:\/\/books\.google\.com\/books\/content\?/);
    expect(url).not.toContain('edge=curl');
    expect(url).toContain('zoom=1');
    expect(url).toContain('fife=w400-h600');
  });

  it('rejects hosts outside the allowlist and odd URLs', () => {
    expect(hardenCoverUrl('https://evil.example/cover.jpg')).toBeNull();
    expect(hardenCoverUrl('https://books.google.com.evil.example/c.jpg')).toBeNull();
    expect(hardenCoverUrl('https://user:pw@covers.openlibrary.org/b/id/1-L.jpg')).toBeNull();
    expect(hardenCoverUrl('javascript:alert(1)')).toBeNull();
    expect(hardenCoverUrl('not a url')).toBeNull();
    expect(hardenCoverUrl(null)).toBeNull();
  });

  it('orders and de-duplicates candidates, ending with Open Library by ISBN', () => {
    const stored = 'https://covers.openlibrary.org/b/id/42-L.jpg?default=false';
    expect(
      coverCandidates({
        coverUrl: stored,
        isbn13: '9788576573135',
        extra: [stored, 'https://evil.example/x.jpg'],
      }),
    ).toEqual([stored, openLibraryIsbnCover('9788576573135')]);
    expect(coverCandidates({ coverUrl: null, isbn13: null })).toEqual([]);
  });
});

describe('fallback helpers', () => {
  it('builds initials and stable palette buckets', () => {
    expect(titleInitials('O Hobbit')).toBe('OH');
    expect(titleInitials('“1984”')).toBe('1');
    expect(titleInitials('   ')).toBe('?');
    expect(stableBucket('Duna', 5)).toBe(stableBucket('Duna', 5));
    expect(stableBucket('Duna', 5)).toBeGreaterThanOrEqual(0);
    expect(stableBucket('Duna', 5)).toBeLessThan(5);
  });

  it('extracts publication years', () => {
    expect(parsePublishedYear('2019-05-02')).toBe(2019);
    expect(parsePublishedYear('May 1965')).toBe(1965);
    expect(parsePublishedYear(1937)).toBe(1937);
    expect(parsePublishedYear('s.d.')).toBeNull();
    expect(parsePublishedYear(undefined)).toBeNull();
  });
});
