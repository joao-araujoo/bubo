import { type CatalogBook } from '@bubo/contracts';
import { type Genre } from '@bubo/domain';
import { useEffect, useState } from 'react';

import { ApiError } from '../../lib/api/client';

/**
 * Catalog queries per onboarding genre. Google Books and Open Library both understand
 * `subject:` (Google matches its English BISAC categories), so these stay in English on purpose.
 */
export const GENRE_QUERIES: Record<Genre, string> = {
  science_fiction: 'subject:"science fiction"',
  philosophy: 'subject:philosophy',
  fantasy: 'subject:fantasy',
  psychology: 'subject:psychology',
  history: 'subject:history',
  business: 'subject:business',
  technology: 'subject:technology',
  biography: 'subject:biography',
  science: 'subject:science',
  mystery: 'subject:mystery',
  self_care: 'subject:"self-help"',
};

/** Value that only settles after `delayMs` without changes (typing → one request). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/** "Frank Herbert" / "Machado de Assis, Outro" → a single display line. */
export function authorLine(book: Pick<CatalogBook, 'authors'>): string | null {
  return book.authors.length ? book.authors.slice(0, 2).join(', ') : null;
}

/** "Frank Herbert · Aleph · 2017" (only what is known). */
export function metaLine(book: CatalogBook): string {
  return [
    authorLine(book),
    book.publisher,
    book.publishedYear ? String(book.publishedYear) : null,
    editionLabel(book),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function catalogErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return 'Sem conexão. Confira sua internet e tente de novo.';
    }
    if (error.code === 'RATE_LIMITED') return 'Muitas buscas seguidas. Espere um instante.';
    if (error.code === 'INVALID_RESPONSE')
      return 'Não foi possível acessar a busca. Confira a conexão com a API e tente de novo.';
    if (error.code === 'UNAUTHORIZED')
      return 'Sua sessão expirou. Entre novamente para buscar livros.';
    if (error.code === 'SERVICE_UNAVAILABLE') {
      return 'O catálogo de livros está indisponível agora. Tente em alguns minutos.';
    }
    if (error.code === 'NOT_FOUND') return 'Não encontramos esse livro no catálogo.';
    if (error.code === 'CONFLICT') return 'Esse livro já está na sua estante.';
  }
  return 'Algo deu errado. Tente de novo.';
}

/**
 * Hand-off between the ISBN scanner and the screen that opened it (onboarding picks a first book
 * without adding it yet). Read once, then cleared.
 */
let pendingPick: CatalogBook | null = null;
export const scannerPick = {
  set(book: CatalogBook) {
    pendingPick = book;
  },
  take(): CatalogBook | null {
    const book = pendingPick;
    pendingPick = null;
    return book;
  },
};

export function editionLabel(book: CatalogBook): string {
  const labels: Record<string, string> = {
    pt: 'Português',
    en: 'Inglês',
    es: 'Espanhol',
    fr: 'Francês',
    de: 'Alemão',
    it: 'Italiano',
  };
  const language = book.language
    ? (labels[book.language.split('-')[0] ?? ''] ?? book.language)
    : 'Idioma não informado';
  const formats: Record<string, string> = { PHYSICAL: 'Impresso', DIGITAL: 'Digital' };
  return [
    language,
    book.format ? (formats[book.format] ?? book.format) : null,
    book.match === 'approximate' ? 'Correspondência aproximada' : null,
    book.edition === 'work' ? 'Edição não identificada' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
