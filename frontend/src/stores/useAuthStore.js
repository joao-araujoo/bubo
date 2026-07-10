import { create } from 'zustand';
import api from '../services/api';

const getStoredAuth = () => {
  try {
    const token = localStorage.getItem('bubo_token');
    const user = JSON.parse(localStorage.getItem('bubo_user') || 'null');
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const persistUser = (user) => {
  localStorage.setItem('bubo_user', JSON.stringify(user));
};

export const useAuthStore = create((set) => ({
  ...getStoredAuth(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('bubo_token', data.token);
      persistUser(data.user);
      set({ token: data.token, user: data.user, isLoading: false });
      return data;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível entrar.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', { username, email, password });
      localStorage.setItem('bubo_token', data.token);
      persistUser(data.user);
      set({ token: data.token, user: data.user, isLoading: false });
      return data;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível criar sua conta.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  refreshProfile: async () => {
    try {
      const { data } = await api.get('/auth/profile');
      persistUser(data.user);
      set({ user: data.user });
      return data.user;
    } catch (error) {
      const message = error.response?.data?.message || 'Não foi possível atualizar seu perfil.';
      throw new Error(message);
    }
  },

  updateProfile: async (updates) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.patch('/auth/profile', updates);
      persistUser(data.user);
      set({ user: data.user, isLoading: false });
      return data.user;
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.msg;
      const message = validationMessage || error.response?.data?.message || 'Não foi possível salvar o perfil.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: () => {
    localStorage.removeItem('bubo_token');
    localStorage.removeItem('bubo_user');
    set({ token: null, user: null, error: null });
  },

  clearError: () => set({ error: null })
}));
