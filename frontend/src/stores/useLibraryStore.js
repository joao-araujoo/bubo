import { create } from 'zustand';
import api from '../services/api';

export const useLibraryStore = create((set, get) => ({
  books: [],
  isLoading: false,
  isUpdating: false,
  hasLoaded: false,
  error: null,

  fetchLibrary: async ({ force = false } = {}) => {
    if (get().isLoading || (get().hasLoaded && !force)) return get().books;

    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/books/library');
      const books = data.userBooks || [];
      set({ books, isLoading: false, hasLoaded: true });
      return books;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível carregar a biblioteca.';
      set({ error: message, isLoading: false, hasLoaded: true });
      throw new Error(message);
    }
  },

  addBook: async (bookData, status = 'to-read') => {
    set({ isUpdating: true, error: null });
    try {
      const { data } = await api.post('/books/library', { ...bookData, status });
      set((state) => ({
        books: [data.userBook, ...state.books],
        isUpdating: false,
        hasLoaded: true
      }));
      return data.userBook;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível adicionar o livro.';
      set({ error: message, isUpdating: false });
      throw new Error(message);
    }
  },

  updateBookStatus: async (userBookId, updates) => {
    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    set({ isUpdating: true, error: null });
    try {
      const { data } = await api.patch(`/books/library/${userBookId}`, payload);
      set((state) => ({
        books: state.books.map((book) => (book._id === userBookId ? data.userBook : book)),
        isUpdating: false
      }));
      return data.userBook;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível atualizar o livro.';
      set({ error: message, isUpdating: false });
      throw new Error(message);
    }
  },

  updateBookPage: (userBookId, currentPage) => {
    set((state) => ({
      books: state.books.map((book) =>
        book._id === userBookId ? { ...book, currentPage } : book
      )
    }));
  },

  resetLibrary: () => set({
    books: [],
    isLoading: false,
    isUpdating: false,
    hasLoaded: false,
    error: null
  })
}));
