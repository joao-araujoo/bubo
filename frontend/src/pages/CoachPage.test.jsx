import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CoachPage from './CoachPage';
import { useCoachStore } from '../stores/useCoachStore';
import { useLibraryStore } from '../stores/useLibraryStore';

vi.mock('../stores/useCoachStore', () => ({
  useCoachStore: vi.fn(),
}));

vi.mock('../stores/useLibraryStore', () => ({
  useLibraryStore: vi.fn(),
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/coach']}>
    <Routes>
      <Route path="/coach" element={<CoachPage />} />
      <Route path="/library" element={<h1>Acervo acessível</h1>} />
      <Route path="/library/:id" element={<h1>Leitura acessível</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('CoachPage', () => {
  const fetchProfile = vi.fn().mockResolvedValue(undefined);
  const fetchLibrary = vi.fn().mockResolvedValue([]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('states clearly that no local or simulated evaluator exists', async () => {
    const profile = {
      coach: { connected: false, provider: null, model: null },
      summary: { totalReviews: 0 },
      dimensions: {},
      books: [],
    };
    useCoachStore.mockReturnValue({ error: null, fetchProfile, isLoadingProfile: false, profile });
    useLibraryStore.mockReturnValue({ books: [], fetchLibrary });

    renderPage();

    expect(screen.getAllByText('IA não configurada').length).toBeGreaterThan(0);
    expect(screen.getByText('Nenhuma avaliação simulada será criada')).toBeInTheDocument();
    expect(screen.queryByText(/Modo local ativo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Avaliador local/i)).not.toBeInTheDocument();

    const openLibraryButtons = screen.getAllByRole('button', { name: 'Abrir acervo' });
    fireEvent.click(openLibraryButtons.at(-1));
    expect(await screen.findByRole('heading', { name: 'Acervo acessível' })).toBeInTheDocument();
  });

  it('connects each retention prompt to the matching library reading', () => {
    const profile = {
      coach: { connected: true, provider: 'gemini', model: 'gemini-test' },
      summary: { totalReviews: 1, approvedReviews: 1, averageDepth: 82, highestDepth: 82, trend: 'collecting' },
      dimensions: {},
      books: [{
        bookId: 'catalog-book-1',
        title: 'Duna',
        reviews: 1,
        averageDepth: 82,
        lastReviewAt: '2026-07-10T12:00:00.000Z',
        retentionPrompt: 'Explique a tensão política principal.',
      }],
    };
    useCoachStore.mockReturnValue({ error: null, fetchProfile, isLoadingProfile: false, profile });
    useLibraryStore.mockReturnValue({
      books: [{ _id: 'user-book-1', bookId: { _id: 'catalog-book-1', title: 'Duna' } }],
      fetchLibrary,
    });

    renderPage();

    expect(screen.getByText('Google Gemini · gemini-test')).toBeInTheDocument();
    expect(screen.getByText('Explique a tensão política principal.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir leitura' })).toHaveAttribute('href', '/library/user-book-1');
  });
});
