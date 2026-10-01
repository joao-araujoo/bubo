import { expect, it } from 'vitest';
import { friendPairId } from '../src/friends';
it('uses one id for reciprocal requests without delimiter collisions', () => {
  expect(friendPairId('a', 'b')).toBe(friendPairId('b', 'a'));
  expect(friendPairId('a:b', 'c')).not.toBe(friendPairId('a', 'b:c'));
});
