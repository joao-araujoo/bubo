import { create } from 'zustand';
import api from '../services/api';

const getMessage = (error, fallback) => error.response?.data?.message || fallback;

export const useCoachStore = create((set) => ({
  status: null,
  profile: null,
  isLoadingStatus: false,
  isLoadingProfile: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoadingStatus: true, error: null });
    try {
      const { data } = await api.get('/deep-review/status');
      set({ status: data.coach, isLoadingStatus: false });
      return data.coach;
    } catch (error) {
      const message = getMessage(error, 'Não foi possível verificar o status da IA.');
      set({ error: message, isLoadingStatus: false });
      throw new Error(message);
    }
  },

  fetchProfile: async () => {
    set({ isLoadingProfile: true, error: null });
    try {
      const { data } = await api.get('/deep-review/profile');
      set({ profile: data, status: data.coach, isLoadingProfile: false });
      return data;
    } catch (error) {
      const message = getMessage(error, 'Não foi possível carregar seu perfil cognitivo.');
      set({ error: message, isLoadingProfile: false });
      throw new Error(message);
    }
  },

  resetCoach: () => set({
    status: null,
    profile: null,
    isLoadingStatus: false,
    isLoadingProfile: false,
    error: null
  })
}));
