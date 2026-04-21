import { create } from 'zustand';
import api from '../services/api';

export const useLibraryStore = create((set, get) => ({
  books: [],
  isLoading: false,
  error: null,

  fetchLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/books/library');
      set({ books: data.userBooks, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to load library', isLoading: false });
    }
  },

  addBook: async (bookData, status = 'to-read') => {
    try {
      const { data } = await api.post('/books/library', { ...bookData, status });
      set((state) => ({ books: [data.userBook, ...state.books] }));
      return data.userBook;
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to add book');
    }
  },

  updateBookStatus: async (userBookId, updates) => {
    try {
      const { data } = await api.patch(`/books/library/${userBookId}`, updates);
      set((state) => ({
        books: state.books.map((b) => (b._id === userBookId ? data.userBook : b))
      }));
      return data.userBook;
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to update book');
    }
  },

  updateBookPage: (userBookId, currentPage) => {
    set((state) => ({
      books: state.books.map((b) =>
        b._id === userBookId ? { ...b, currentPage } : b
      )
    }));
  }
}));
