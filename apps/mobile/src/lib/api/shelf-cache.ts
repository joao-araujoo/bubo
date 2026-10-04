import {
  type CatalogBookResponse,
  type ShelfEntry,
  type ShelfEntryDetail,
  type ShelfResponse,
} from '@bubo/contracts';
import { type QueryClient } from '@tanstack/react-query';

/** Apply only API-accepted entries, without inventing an unloaded shelf or session history. */
export function cacheAcceptedShelfEntry(client: QueryClient, userId: string, entry: ShelfEntry) {
  client.setQueryData<ShelfResponse>(['shelf', userId], (shelf) =>
    shelf
      ? { entries: [entry, ...shelf.entries.filter((item) => item.id !== entry.id)] }
      : undefined,
  );
  client.setQueryData<ShelfEntryDetail>(['shelf', userId, entry.id], (detail) =>
    detail ? { ...detail, entry } : undefined,
  );
  client.setQueriesData<CatalogBookResponse>(
    {
      predicate: (query) =>
        query.queryKey[0] === 'catalog' &&
        query.queryKey[1] === userId &&
        (query.queryKey[2] === 'book' || query.queryKey[2] === 'isbn'),
    },
    (detail) =>
      detail &&
      (detail.book.catalogId === entry.book.catalogId ||
        (entry.book.isbn13 !== null && detail.book.isbn13 === entry.book.isbn13))
        ? { ...detail, shelfEntryId: entry.id }
        : detail,
  );
}
