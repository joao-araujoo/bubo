import { create } from 'zustand';
import api from '../services/api';

const LIBRARY_STALE_MS = 60 * 1000;
let libraryRequest = null;

const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

export const useLibraryStore = create((set, get) => ({
  books: [],
  isLoading: false,
  isUpdating: false,
  updatingIds: [],
  hasLoaded: false,
  lastFetchedAt: 0,
  error: null,

  fetchLibrary: async ({ force = false } = {}) => {
    const state = get();
    const isFresh = state.hasLoaded && Date.now() - state.lastFetchedAt < LIBRARY_STALE_MS;
    if (!force && isFresh) return state.books;
    if (libraryRequest) return libraryRequest;

    set({ isLoading: !state.hasLoaded, error: null });
    libraryRequest = api.get('/books/library')
      .then(({ data }) => {
        const books = data.userBooks || [];
        set({
          books,
          isLoading: false,
          hasLoaded: true,
          lastFetchedAt: Date.now(),
          error: null,
        });
        return books;
      })
      .catch((error) => {
        const message = errorMessage(error, 'Não foi possível carregar a biblioteca.');
        set({ error: message, isLoading: false, hasLoaded: true });
        throw new Error(message);
      })
      .finally(() => {
        libraryRequest = null;
      });

    return libraryRequest;
  },

  addBook: async (bookData, status = 'to-read') => {
    const temporaryId = `adding:${bookData.canonicalId || bookData.googleBooksId || bookData.openLibraryKey}`;
    set((state) => ({
      isUpdating: true,
      updatingIds: [...new Set([...state.updatingIds, temporaryId])],
      error: null,
    }));

    try {
      const { data } = await api.post('/books/library', { ...bookData, status });
      set((state) => ({
        books: [data.userBook, ...state.books.filter((item) => item._id !== data.userBook._id)],
        updatingIds: state.updatingIds.filter((id) => id !== temporaryId),
        isUpdating: state.updatingIds.filter((id) => id !== temporaryId).length > 0,
        hasLoaded: true,
        lastFetchedAt: Date.now(),
      }));
      return data.userBook;
    } catch (error) {
      const message = errorMessage(error, 'Não foi possível adicionar o livro.');
      set((state) => ({
        error: message,
        updatingIds: state.updatingIds.filter((id) => id !== temporaryId),
        isUpdating: state.updatingIds.filter((id) => id !== temporaryId).length > 0,
      }));
      throw new Error(message);
    }
  },

  updateBookStatus: async (userBookId, updates) => {
    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );
    const previous = get().books.find((book) => book._id === userBookId);
    if (!previous) throw new Error('Livro não encontrado no acervo atual.');

    set((state) => ({
      books: state.books.map((book) => (
        book._id === userBookId ? { ...book, ...payload, updatedAt: new Date().toISOString() } : book
      )),
      updatingIds: [...new Set([...state.updatingIds, userBookId])],
      isUpdating: true,
      error: null,
    }));

    try {
      const { data } = await api.patch(`/books/library/${userBookId}`, payload);
      set((state) => {
        const updatingIds = state.updatingIds.filter((id) => id !== userBookId);
        return {
          books: state.books.map((book) => (book._id === userBookId ? data.userBook : book)),
          updatingIds,
          isUpdating: updatingIds.length > 0,
          lastFetchedAt: Date.now(),
        };
      });
      return data.userBook;
    } catch (error) {
      const message = errorMessage(error, 'Não foi possível atualizar o livro.');
      set((state) => {
        const updatingIds = state.updatingIds.filter((id) => id !== userBookId);
        return {
          books: state.books.map((book) => (book._id === userBookId ? previous : book)),
          error: message,
          updatingIds,
          isUpdating: updatingIds.length > 0,
        };
      });
      throw new Error(message);
    }
  },

  removeBook: async (userBookId) => {
    const previousBooks = get().books;
    const removed = previousBooks.find((book) => book._id === userBookId);
    if (!removed) return;

    set((state) => ({
      books: state.books.filter((book) => book._id !== userBookId),
      updatingIds: [...new Set([...state.updatingIds, userBookId])],
      isUpdating: true,
      error: null,
    }));

    try {
      await api.delete(`/books/library/${userBookId}`);
      set((state) => {
        const updatingIds = state.updatingIds.filter((id) => id !== userBookId);
        return {
          updatingIds,
          isUpdating: updatingIds.length > 0,
          lastFetchedAt: Date.now(),
        };
      });
    } catch (error) {
      const message = errorMessage(error, 'Não foi possível remover o livro.');
      set((state) => {
        const updatingIds = state.updatingIds.filter((id) => id !== userBookId);
        return {
          books: previousBooks,
          error: message,
          updatingIds,
          isUpdating: updatingIds.length > 0,
        };
      });
      throw new Error(message);
    }
  },

  updateBookPage: (userBookId, currentPage) => {
    set((state) => ({
      books: state.books.map((book) => (
        book._id === userBookId ? { ...book, currentPage, updatedAt: new Date().toISOString() } : book
      )),
    }));
  },

  resetLibrary: () => {
    libraryRequest = null;
    set({
      books: [],
      isLoading: false,
      isUpdating: false,
      updatingIds: [],
      hasLoaded: false,
      lastFetchedAt: 0,
      error: null,
    });
  },
}));
