import { type CatalogBook } from '@bubo/contracts';
import { coverUrlForWidth } from '@bubo/domain';
import { Image } from 'expo-image';

const pending = new Set<string>();
const queue: string[] = [];
let active = 0;

function drain() {
  while (active < 2 && queue.length) {
    const url = queue.shift();
    if (!url) return;
    active += 1;
    void Image.prefetch(url, 'memory-disk')
      .then((loaded) => {
        if (!loaded) pending.delete(url);
      })
      .catch(() => pending.delete(url))
      .finally(() => {
        active -= 1;
        drain();
      });
  }
}

/**
 * Warms expo-image's memory + disk cache with each book's first cover candidate at the size it
 * will be drawn (ADR-031), so carousels show real covers as soon as they scroll into view.
 */
export function prefetchCovers(books: readonly Pick<CatalogBook, 'coverUrls'>[], width: number) {
  const urls = [
    ...new Set(
      books
        .map((book) => book.coverUrls[0])
        .filter((url): url is string => url !== undefined)
        .map((url) => coverUrlForWidth(url, width)),
    ),
  ];
  for (const url of urls) {
    if (pending.has(url)) continue;
    pending.add(url);
    queue.push(url);
  }
  drain();
}
