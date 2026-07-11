import { create } from 'zustand';
import api from '../services/api';

const COACH_STALE_MS = 60 * 1000;
let profileRequest = null;
let statusRequest = null;

const getMessage = (error, fallback) => error.response?.data?.message || fallback;

export const useCoachStore = create((set, get) => ({
  status: null,
  profile: null,
  isLoadingStatus: false,
  isLoadingProfile: false,
  lastProfileFetchedAt: 0,
  lastStatusFetchedAt: 0,
  error: null,

  fetchStatus: async ({ force = false } = {}) => {
    const state = get();
    const fresh = state.status && Date.now() - state.lastStatusFetchedAt < COACH_STALE_MS;
    if (!force && fresh) return state.status;
    if (statusRequest) return statusRequest;

    set({ isLoadingStatus: !state.status, error: null });
    statusRequest = api.get('/deep-review/status')
      .then(({ data }) => {
        set({ status: data.coach, isLoadingStatus: false, lastStatusFetchedAt: Date.now() });
        return data.coach;
      })
      .catch((error) => {
        const message = getMessage(error, 'Não foi possível verificar o status da IA.');
        set({ error: message, isLoadingStatus: false });
        throw new Error(message);
      })
      .finally(() => {
        statusRequest = null;
      });

    return statusRequest;
  },

  fetchProfile: async ({ force = false } = {}) => {
    const state = get();
    const fresh = state.profile && Date.now() - state.lastProfileFetchedAt < COACH_STALE_MS;
    if (!force && fresh) return state.profile;
    if (profileRequest) return profileRequest;

    set({ isLoadingProfile: !state.profile, error: null });
    profileRequest = api.get('/deep-review/profile')
      .then(({ data }) => {
        const now = Date.now();
        set({
          profile: data,
          status: data.coach,
          isLoadingProfile: false,
          lastProfileFetchedAt: now,
          lastStatusFetchedAt: now,
          error: null,
        });
        return data;
      })
      .catch((error) => {
        const message = getMessage(error, 'Não foi possível carregar seu perfil cognitivo.');
        set({ error: message, isLoadingProfile: false });
        throw new Error(message);
      })
      .finally(() => {
        profileRequest = null;
      });

    return profileRequest;
  },

  resetCoach: () => {
    profileRequest = null;
    statusRequest = null;
    set({
      status: null,
      profile: null,
      isLoadingStatus: false,
      isLoadingProfile: false,
      lastProfileFetchedAt: 0,
      lastStatusFetchedAt: 0,
      error: null,
    });
  },
}));
