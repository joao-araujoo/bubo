import { describe, expect, it } from 'vitest';
import { normalizeManualBookKey } from './manual-book';

describe('normalizeManualBookKey', () => {
  it('creates a stable accent-insensitive key', () => {
    expect(
      normalizeManualBookKey('Memórias Póstumas', 'Machado de Assis'),
    ).toBe('manual:memorias-postumas-machado-de-assis');
  });

  it('never returns an empty source id', () => {
    expect(normalizeManualBookKey('***', '---')).toBe('manual:book');
  });
});
