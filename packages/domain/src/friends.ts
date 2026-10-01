/** One stable id per unordered pair. Never auto-accept reciprocal requests. */
export function friendPairId(first: string, second: string): string {
  return JSON.stringify([first, second].sort());
}
