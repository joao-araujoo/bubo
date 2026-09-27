import { describe, expect, it } from 'vitest';

import {
  isbn10To13,
  isValidIsbn10,
  isValidIsbn13,
  normalizeIsbn,
  toIsbn13,
  toIsbn10,
} from '../src';

describe('ISBN', () => {
  it('accepts printed prefixes and Unicode hyphens, and converts only the 978 range to ISBN-10', () => {
    expect(toIsbn13('ISBN-10: ８５７６５７３１３x')).toBe('9788576573135');
    expect(toIsbn13('ISBN-13: 978–85–7657–313–5')).toBe('9788576573135');
    expect(toIsbn10('9788576573135')).toBe('857657313X');
    expect(toIsbn10('9791090636071')).toBeNull();
    expect(toIsbn13('ISBN 9788576573136')).toBeNull();
  });
  it('normalizes hyphens and spaces', () => {
    expect(normalizeIsbn('978-85-359-0277-8 ')).toBe('9788535902778');
  });

  it('validates ISBN-13 checksums', () => {
    expect(isValidIsbn13('9788535902778')).toBe(true);
    expect(isValidIsbn13('9780141182506')).toBe(true);
    expect(isValidIsbn13('9788535902771')).toBe(false);
    expect(isValidIsbn13('1234567890123')).toBe(false);
  });

  it('validates ISBN-10 checksums, including X', () => {
    expect(isValidIsbn10('0141182504')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
    expect(isValidIsbn10('0141182505')).toBe(false);
  });

  it('converts ISBN-10 to ISBN-13', () => {
    expect(isbn10To13('0141182504')).toBe('9780141182506');
    expect(toIsbn13('0-14-118250-4')).toBe('9780141182506');
    expect(toIsbn13('9788535902778')).toBe('9788535902778');
    expect(toIsbn13('not-an-isbn')).toBeNull();
    expect(toIsbn13(null)).toBeNull();
  });
});
