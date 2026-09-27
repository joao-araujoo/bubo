import { type CatalogBook } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { ApiError } from '../../lib/api/client';
import { useAddBook, useShelf } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { catalogErrorMessage } from './catalog';

/**
 * Adds a catalog book to the shelf by id (the server resolves the metadata) and opens it.
 * Tracks which book is pending so lists can show a spinner on the right row.
 */
export function useAddFromCatalog(userId: string, navigation: 'push' | 'replace' = 'push') {
  const router = useRouter();
  const add = useAddBook(userId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function addToShelf(
    book: CatalogBook,
    status: 'reading' | 'want_to_read' = 'want_to_read',
  ) {
    if (pendingId) return;
    setPendingId(book.catalogId);
    try {
      const entry = await add.mutateAsync({ catalogId: book.catalogId, status });
      haptics.success();
      const target = { pathname: '/livro/[id]' as const, params: { id: entry.id } };
      if (navigation === 'replace') router.replace(target);
      else router.push(target);
    } catch (error) {
      haptics.error();
      Alert.alert(
        error instanceof ApiError && error.code === 'CONFLICT'
          ? 'Já está na estante'
          : 'Não foi possível adicionar',
        catalogErrorMessage(error),
      );
    } finally {
      setPendingId(null);
    }
  }

  return { addToShelf, pendingId };
}

/** Finds the reader's shelf entry for a catalog book (by catalog id or ISBN-13) from the cache. */
export function useShelfLookup(userId: string) {
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
      null,
    [index],
  );
}
