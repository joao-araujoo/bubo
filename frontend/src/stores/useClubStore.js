import { create } from 'zustand';
import api from '../services/api';

const apiError = (error, fallback) => ({
  code: error.response?.data?.code || 'CLUB_REQUEST_FAILED',
  message: error.response?.data?.errors?.[0]?.msg
    || error.response?.data?.message
    || fallback,
});

export const useClubStore = create((set, get) => ({
  clubs: [],
  activeClub: null,
  isLoading: false,
  isMutating: false,
  error: null,
  errorCode: null,

  fetchClubs: async (scope = 'all') => {
    set({ isLoading: true, error: null, errorCode: null });
    try {
      const { data } = await api.get('/clubs', { params: { scope } });
      set({ clubs: data.clubs || [], isLoading: false });
      return data.clubs || [];
    } catch (error) {
      const failure = apiError(error, 'Não foi possível carregar os clubes.');
      set({ error: failure.message, errorCode: failure.code, isLoading: false });
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  },

  fetchClub: async (clubId) => {
    set({ isLoading: true, error: null, errorCode: null });
    try {
      const { data } = await api.get(`/clubs/${clubId}`);
      set((state) => ({
        activeClub: data.club,
        clubs: state.clubs.map((club) => (club._id === data.club._id ? { ...club, ...data.club } : club)),
        isLoading: false,
      }));
      return data.club;
    } catch (error) {
      const failure = apiError(error, 'Não foi possível abrir este clube.');
      set({ activeClub: null, error: failure.message, errorCode: failure.code, isLoading: false });
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  },

  createClub: async (payload) => {
    set({ isMutating: true, error: null, errorCode: null });
    try {
      const { data } = await api.post('/clubs', payload);
      set((state) => ({
        clubs: [data.club, ...state.clubs],
        activeClub: data.club,
        isMutating: false,
      }));
      return data.club;
    } catch (error) {
      const failure = apiError(error, 'Não foi possível criar o clube.');
      set({ error: failure.message, errorCode: failure.code, isMutating: false });
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  },

  joinClub: async (clubId, inviteCode = '') => {
    set({ isMutating: true, error: null, errorCode: null });
    try {
      const { data } = await api.post(`/clubs/${clubId}/join`, { inviteCode });
      set((state) => ({
        clubs: state.clubs.map((club) => (club._id === clubId ? { ...club, ...data.club } : club)),
        activeClub: state.activeClub?._id === clubId ? { ...state.activeClub, ...data.club } : data.club,
        isMutating: false,
      }));
      return data.club;
    } catch (error) {
      const failure = apiError(error, 'Não foi possível entrar no clube.');
      set({ error: failure.message, errorCode: failure.code, isMutating: false });
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  },

  leaveClub: async (clubId) => {
    set({ isMutating: true, error: null, errorCode: null });
    try {
      await api.delete(`/clubs/${clubId}/leave`);
      set((state) => ({
        clubs: state.clubs.filter((club) => club._id !== clubId),
        activeClub: state.activeClub?._id === clubId ? null : state.activeClub,
        isMutating: false,
      }));
    } catch (error) {
      const failure = apiError(error, 'Não foi possível sair do clube.');
      set({ error: failure.message, errorCode: failure.code, isMutating: false });
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  },

  updateProgress: async (clubId, currentPage) => {
    set({ isMutating: true, error: null, errorCode: null });
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
      const failure = apiError(error, 'Não foi possível atualizar o progresso.');
      set({ error: failure.message, errorCode: failure.code, isMutating: false });
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  },

  createDiscussion: async (clubId, payload) => {
    set({ isMutating: true, error: null, errorCode: null });
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
      const failure = apiError(error, 'Não foi possível publicar no clube.');
      set({ error: failure.message, errorCode: failure.code, isMutating: false });
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  },

  clearActiveClub: () => set({ activeClub: null, error: null, errorCode: null }),
  resetClubs: () => set({
    clubs: [],
    activeClub: null,
    isLoading: false,
    isMutating: false,
    error: null,
    errorCode: null,
  }),
}));
