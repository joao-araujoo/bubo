import { create } from 'zustand';
import api from '../services/api';

export const useClubStore = create((set, get) => ({
  clubs: [],
  activeClub: null,
  isLoading: false,
  isMutating: false,
  error: null,

  fetchClubs: async (scope = 'all') => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/clubs', { params: { scope } });
      set({ clubs: data.clubs || [], isLoading: false });
      return data.clubs || [];
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível carregar os clubes.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  fetchClub: async (clubId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/clubs/${clubId}`);
      set((state) => ({
        activeClub: data.club,
        clubs: state.clubs.map((club) => (club._id === data.club._id ? { ...club, ...data.club } : club)),
        isLoading: false,
      }));
      return data.club;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível abrir este clube.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  createClub: async (payload) => {
    set({ isMutating: true, error: null });
    try {
      const { data } = await api.post('/clubs', payload);
      set((state) => ({
        clubs: [data.club, ...state.clubs],
        activeClub: data.club,
        isMutating: false,
      }));
      return data.club;
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.msg;
      const message = validationMessage || error.response?.data?.message || 'Não foi possível criar o clube.';
      set({ error: message, isMutating: false });
      throw new Error(message);
    }
  },

  joinClub: async (clubId, inviteCode = '') => {
    set({ isMutating: true, error: null });
    try {
      const { data } = await api.post(`/clubs/${clubId}/join`, { inviteCode });
      set((state) => ({
        clubs: state.clubs.map((club) => (club._id === clubId ? { ...club, ...data.club } : club)),
        activeClub: state.activeClub?._id === clubId ? { ...state.activeClub, ...data.club } : state.activeClub,
        isMutating: false,
      }));
      return data.club;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível entrar no clube.';
      set({ error: message, isMutating: false });
      throw new Error(message);
    }
  },

  leaveClub: async (clubId) => {
    set({ isMutating: true, error: null });
    try {
      await api.delete(`/clubs/${clubId}/leave`);
      set((state) => ({
        clubs: state.clubs.filter((club) => club._id !== clubId),
        activeClub: state.activeClub?._id === clubId ? null : state.activeClub,
        isMutating: false,
      }));
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível sair do clube.';
      set({ error: message, isMutating: false });
      throw new Error(message);
    }
  },

  updateProgress: async (clubId, currentPage) => {
    set({ isMutating: true, error: null });
    try {
      const { data } = await api.patch(`/clubs/${clubId}/progress`, { currentPage });
      const updated = {
        ...get().activeClub,
        ...data.club,
        membership: {
          ...(get().activeClub?.membership || {}),
          ...data.membership,
        },
      };
      set((state) => ({
        activeClub: updated,
        clubs: state.clubs.map((club) => (club._id === clubId ? { ...club, ...data.club } : club)),
        isMutating: false,
      }));
      return updated;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível atualizar o progresso.';
      set({ error: message, isMutating: false });
      throw new Error(message);
    }
  },

  createDiscussion: async (clubId, payload) => {
    set({ isMutating: true, error: null });
    try {
      const { data } = await api.post(`/clubs/${clubId}/discussions`, payload);
      set((state) => ({
        activeClub: state.activeClub?._id === clubId
          ? {
              ...state.activeClub,
              discussions: [data.discussion, ...(state.activeClub.discussions || [])],
              stats: {
                ...state.activeClub.stats,
                discussionsCount: (state.activeClub.stats?.discussionsCount || 0) + 1,
              },
            }
          : state.activeClub,
        isMutating: false,
      }));
      return data.discussion;
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.msg;
      const message = validationMessage || error.response?.data?.message || 'Não foi possível publicar no clube.';
      set({ error: message, isMutating: false });
      throw new Error(message);
    }
  },

  clearActiveClub: () => set({ activeClub: null, error: null }),
  resetClubs: () => set({ clubs: [], activeClub: null, isLoading: false, isMutating: false, error: null }),
}));
