import { create } from 'zustand';
import api from '../services/api';

export const useSocialStore = create((set) => ({
  activities: [],
  isLoading: false,
  isPublishing: false,
  error: null,

  fetchFeed: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/social/feed');
      set({ activities: data.activities || [], isLoading: false });
      return data.activities || [];
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível carregar o feed.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  createPost: async ({ message, insight = '', postType = 'free', bookId }) => {
    set({ isPublishing: true, error: null });
    try {
      const { data } = await api.post('/social/activity', {
        type: 'post',
        postType,
        message,
        insight,
        bookId
      });
      set((state) => ({
        activities: [data.activity, ...state.activities],
        isPublishing: false
      }));
      return data.activity;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível publicar agora.';
      set({ error: message, isPublishing: false });
      throw new Error(message);
    }
  }
}));
