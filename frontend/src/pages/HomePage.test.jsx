import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';
import { useAuthStore } from '../stores/useAuthStore';
import { useDashboardStore } from '../stores/useDashboardStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useSocialStore } from '../stores/useSocialStore';

vi.mock('../components/social/ReaderRecommendationsSection', () => ({
  default: () => <div>Recomendações carregadas</div>,
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../stores/useDashboardStore', () => ({
  useDashboardStore: vi.fn(),
}));

vi.mock('../stores/useLibraryStore', () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock('../stores/useSocialStore', () => ({
  useSocialStore: vi.fn(),
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/discover" element={<h1>Descoberta acessível</h1>} />
      <Route path="/library" element={<h1>Acervo acessível</h1>} />
      <Route path="/library/:id" element={<h1>Leitura individual acessível</h1>} />
      <Route path="/achievements" element={<h1>Conquistas acessíveis</h1>} />
      <Route path="/feed" element={<h1>Feed acessível</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('HomePage', () => {
  const fetchLibrary = vi.fn().mockResolvedValue([]);
  const fetchDashboard = vi.fn().mockResolvedValue(undefined);
  const fetchFeed = vi.fn().mockResolvedValue(undefined);
  const fetchReaderRecommendations = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.mockReturnValue({ token: 'token', user: { username: 'João' } });
    useDashboardStore.mockReturnValue({
      dashboard: { challenges: [] },
      fetchDashboard,
      isLoading: false,
    });
    useSocialStore.mockReturnValue({
      activities: [],
      fetchFeed,
      fetchReaderRecommendations,
      isLoading: false,
    });
  });

  it('opens the individual reading and respects the edition page override', () => {
    useLibraryStore.mockReturnValue({
      books: [{
        _id: 'user-book-1',
        status: 'reading',
        currentPage: 150,
        totalPagesOverride: 300,
        bookId: {
          _id: 'catalog-book-1',
          title: 'Duna',
          author: 'Frank Herbert',
          totalPages: 500,
          coverImage: '',
        },
      }],
      fetchLibrary,
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('300 no total')).toBeInTheDocument();
    expect(screen.queryByText('500 no total')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continuar' })).toHaveAttribute('href', '/library/user-book-1');

    fireEvent.click(screen.getByRole('link', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Leitura individual acessível' })).toBeInTheDocument();
  });

  it('navigates empty-state actions through React Router without a page reload', async () => {
    useLibraryStore.mockReturnValue({
      books: [{ _id: 'saved-book', status: 'to-read', bookId: { title: 'Livro salvo' } }],
      fetchLibrary,
      isLoading: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir acervo' }));
    expect(await screen.findByRole('heading', { name: 'Acervo acessível' })).toBeInTheDocument();
  });
});
