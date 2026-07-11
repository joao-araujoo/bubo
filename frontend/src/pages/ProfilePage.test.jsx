import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from './ProfilePage';
import { useAchievementStore } from '../stores/useAchievementStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useCoachStore } from '../stores/useCoachStore';
import { useDashboardStore } from '../stores/useDashboardStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useSocialStore } from '../stores/useSocialStore';

vi.mock('../stores/useAchievementStore', () => ({ useAchievementStore: vi.fn() }));
vi.mock('../stores/useAuthStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('../stores/useCoachStore', () => ({ useCoachStore: vi.fn() }));
vi.mock('../stores/useDashboardStore', () => ({ useDashboardStore: vi.fn() }));
vi.mock('../stores/useLibraryStore', () => ({ useLibraryStore: vi.fn() }));
vi.mock('../stores/useSocialStore', () => ({ useSocialStore: vi.fn() }));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/profile']}>
    <Routes>
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/coach" element={<h1>Coach acessível</h1>} />
      <Route path="/feed" element={<h1>Feed acessível</h1>} />
      <Route path="/achievements" element={<h1>Conquistas acessíveis</h1>} />
      <Route path="/library" element={<h1>Acervo acessível</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.mockReturnValue({
      isLoading: false,
      logout: vi.fn(),
      refreshProfile: vi.fn().mockResolvedValue(undefined),
      updateProfile: vi.fn().mockResolvedValue(undefined),
      user: { username: 'João', bio: '', readingGoal: 20, avatar: '' },
    });
    useDashboardStore.mockReturnValue({
      clearDashboard: vi.fn(),
      dashboard: {
        user: { username: 'João', bio: '', readingGoal: 20, avatar: '' },
        stats: {
          booksRead: 0,
          reviewsTotal: 0,
          approvedReviews: 0,
          pagesRegistered: 0,
          averageDepth: 0,
          maxDepth: 0,
          xp: 0,
          annualGoal: 20,
        },
        recentReviews: [],
      },
      fetchDashboard: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
    });
    useAchievementStore.mockReturnValue({
      achievements: [],
      fetchAchievements: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
      resetAchievements: vi.fn(),
    });
    useCoachStore.mockReturnValue({
      fetchProfile: vi.fn().mockResolvedValue(undefined),
      profile: { coach: { connected: false, provider: null, model: null } },
      resetCoach: vi.fn(),
    });
    useSocialStore.mockReturnValue({
      activities: [],
      fetchFeed: vi.fn().mockResolvedValue(undefined),
      resetSocial: vi.fn(),
    });
    useLibraryStore.mockReturnValue({ resetLibrary: vi.fn() });
  });

  it('shows the real disconnected AI state and links to the Reading Coach', () => {
    renderPage();

    expect(screen.getByText('A IA ainda não está configurada. O Bubo não cria notas locais ou simuladas.')).toBeInTheDocument();
    expect(screen.queryByText(/Status da validação:.*disponível/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Reading Coach' })).toHaveAttribute('href', '/coach');
  });

  it('turns empty social history into a direct Feed journey', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Posts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir feed' }));

    expect(await screen.findByRole('heading', { name: 'Feed acessível' })).toBeInTheDocument();
  });
});
