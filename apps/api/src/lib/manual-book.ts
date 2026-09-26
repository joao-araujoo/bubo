export function normalizeManualBookKey(title: string, author: string) {
  const normalized = `${title} ${author}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

  return `manual:${normalized || 'book'}`;
}
