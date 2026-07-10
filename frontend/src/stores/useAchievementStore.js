import { create } from 'zustand';
import api from '../services/api';

export const useAchievementStore = create((set) => ({
  achievements: [],
  metrics: {},
  isLoading: false,
  error: null,

  fetchAchievements: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/achievements');
      set({
        achievements: data.achievements || [],
        metrics: data.metrics || {},
        isLoading: false
      });
      return data;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível carregar suas conquistas.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  }
}));
