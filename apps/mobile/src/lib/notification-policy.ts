/** Only complete known routes can be opened; queries, fragments, escapes and extra paths fail. */
export function notificationPath(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  if (['/revisar', '/notificacoes', '/amigos'].includes(url)) return url;
  if (/^\/(debates|resenhas)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(url)) return url;
  if (/^\/ciclos\/[A-Za-z0-9_-]+$/.test(url)) return url;
  return null;
}

/** A delivered notification belongs to the account it was issued for, even after account switch. */
export function notificationMatchesUser(data: unknown, userId: string): boolean {
  return typeof data === 'object' && data !== null && 'userId' in data && data.userId === userId;
}
