import { create } from 'zustand';
import api from '../services/api';

export const useDashboardStore = create((set) => ({
  dashboard: null,
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/auth/dashboard');
      set({ dashboard: data, isLoading: false });
      return data;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível carregar o seu painel.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  clearDashboard: () => set({ dashboard: null, error: null })
}));
