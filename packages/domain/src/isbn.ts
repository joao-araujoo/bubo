/** ISBN helpers (ISBN-10 / ISBN-13 with checksums). Books are keyed by ISBN-13. */

export function normalizeIsbn(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/^\s*ISBN(?:-1[03])?\s*:?\s*/i, '')
    .replace(/[\s\u2010-\u2015-]/g, '')
    .toUpperCase();
}

export function isValidIsbn13(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const sum = [...isbn].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return sum % 10 === 0;
}

export function isValidIsbn10(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce(
    (acc, char, index) => acc + (char === 'X' ? 10 : Number(char)) * (10 - index),
    0,
  );
  return sum % 11 === 0;
}

/** Converts a valid ISBN-10 to ISBN-13 (978 prefix). */
export function isbn10To13(value: string): string {
  const core = `978${normalizeIsbn(value).slice(0, 9)}`;
  const sum = [...core].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/** Any valid ISBN (10 or 13, hyphens allowed) → ISBN-13, or null when invalid. */
export function toIsbn13(value: string | null | undefined): string | null {
  if (!value) return null;
  const isbn = normalizeIsbn(value);
  if (isValidIsbn13(isbn)) return isbn;
  if (isValidIsbn10(isbn)) return isbn10To13(isbn);
  return null;
}

/** Equivalent ISBN-10, only for the 978 range; 979 has no ISBN-10 equivalent. */
export function toIsbn10(value: string): string | null {
  const isbn = toIsbn13(value);
  if (!isbn?.startsWith('978')) return null;
  const core = isbn.slice(3, 12);
  const sum = [...core].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const check = (11 - (sum % 11)) % 11;
  return `${core}${check === 10 ? 'X' : check}`;
}
