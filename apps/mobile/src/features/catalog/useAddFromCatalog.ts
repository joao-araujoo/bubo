import { type CatalogBook, type CatalogBookResponse } from '@bubo/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ApiError } from '../../lib/api/client';
import { queryKeys, useAddBook, useShelf } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { catalogErrorMessage } from './catalog';

/**
 * Adds a catalog book to the shelf by id (the server resolves the metadata) and opens it.
 * Tracks which book is pending so lists can show a spinner on the right row.
 */
export function useAddFromCatalog(
  userId: string,
  navigation: 'push' | 'replace' | 'stay' = 'push',
) {
  const router = useRouter();
  const client = useQueryClient();
  const add = useAddBook(userId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const adding = useRef(false);

  async function addToShelf(
    book: CatalogBook,
    status: 'reading' | 'want_to_read' | 'finished' = 'want_to_read',
  ) {
    if (adding.current) return;
    adding.current = true;
    setPendingId(book.catalogId);
    try {
      const entry = await add.mutateAsync({ catalogId: book.catalogId, status });
      // This accepted relationship is known even if the full shelf has not loaded yet.
      client.setQueryData<CatalogBookResponse>(
        queryKeys.catalogBook(userId, book.catalogId),
        {
          book,
          shelfEntryId: entry.id,
        },
        { updatedAt: 0 },
      );
      haptics.success();
      const target = { pathname: '/livro/[id]' as const, params: { id: entry.id } };
      if (navigation === 'replace') router.replace(target);
      else if (navigation === 'push') router.push(target);
    } catch (error) {
      haptics.error();
      Alert.alert(
        error instanceof ApiError && error.code === 'CONFLICT'
          ? 'Já está na estante'
          : 'Não foi possível adicionar',
        catalogErrorMessage(error),
      );
    } finally {
      adding.current = false;
      setPendingId(null);
    }
  }

  return { addToShelf, pendingId };
}

/** Finds the reader's shelf entry for a catalog book (by catalog id or ISBN-13) from the cache. */
export function useShelfLookup(userId: string) {
  const client = useQueryClient();
  const shelf = useShelf(userId);
  const index = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of shelf.data?.entries ?? []) {
      if (entry.book.catalogId) map.set(`id:${entry.book.catalogId}`, entry.id);
      if (entry.book.isbn13) map.set(`isbn:${entry.book.isbn13}`, entry.id);
    }
    return map;
  }, [shelf.data]);
  return useCallback(
    (book: Pick<CatalogBook, 'catalogId' | 'isbn13'>): string | null =>
      index.get(`id:${book.catalogId}`) ??
      (book.isbn13 ? index.get(`isbn:${book.isbn13}`) : undefined) ??
      client.getQueryData<CatalogBookResponse>(queryKeys.catalogBook(userId, book.catalogId))
        ?.shelfEntryId ??
      null,
    [index, client, userId],
  );
}
