import { describe, expect, it } from 'vitest';
import { validateClubDiscussion } from './clubDiscussion';

describe('validateClubDiscussion', () => {
  it('allows a contribution without page context', () => {
    expect(validateClubDiscussion({ body: 'Uma interpretação importante.', pageFrom: '', pageTo: '' }, 300)).toBeNull();
  });

  it('requires both contextual pages together', () => {
    expect(validateClubDiscussion({ body: 'Ideia', pageFrom: '20', pageTo: '' }, 300)).toMatch(/página inicial e a página final/i);
  });

  it('rejects inverted and excessive ranges', () => {
    expect(validateClubDiscussion({ body: 'Ideia', pageFrom: '40', pageTo: '30' }, 300)).toMatch(/igual ou maior/i);
    expect(validateClubDiscussion({ body: 'Ideia', pageFrom: '290', pageTo: '320' }, 300)).toMatch(/não podem ultrapassar 300/i);
  });

  it('accepts a complete valid range', () => {
    expect(validateClubDiscussion({ body: 'Ideia', pageFrom: '20', pageTo: '35' }, 300)).toBeNull();
  });
});
