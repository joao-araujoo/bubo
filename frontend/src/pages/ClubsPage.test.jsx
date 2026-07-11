import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClubsPage from './ClubsPage';
import { useClubStore } from '../stores/useClubStore';
import { useLibraryStore } from '../stores/useLibraryStore';

vi.mock('../stores/useClubStore', () => ({
  useClubStore: vi.fn(),
}));

vi.mock('../stores/useLibraryStore', () => ({
  useLibraryStore: vi.fn(),
}));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/clubs']}>
    <Routes>
      <Route path="/clubs" element={<ClubsPage />} />
      <Route path="/discover" element={<h1>Descoberta de livros</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('ClubsPage', () => {
  const fetchClubs = vi.fn().mockResolvedValue([]);
  const fetchLibrary = vi.fn().mockResolvedValue([]);

  beforeEach(() => {
    vi.clearAllMocks();
    useClubStore.mockReturnValue({
      clubs: [],
      createClub: vi.fn(),
      error: null,
      fetchClubs,
      isLoading: false,
      isMutating: false,
      joinClub: vi.fn(),
    });
  });

  it('sends users without books to discovery instead of opening an impossible form', async () => {
    useLibraryStore.mockReturnValue({ books: [], fetchLibrary, isLoading: false });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar livro para criar' }));

    expect(await screen.findByRole('heading', { name: 'Descoberta de livros' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Criar clube de leitura' })).not.toBeInTheDocument();
  });

  it('opens a complete creation form when a catalog book is available', () => {
    useLibraryStore.mockReturnValue({
      books: [{
        _id: 'user-book-1',
        bookId: { _id: 'catalog-book-1', title: 'Duna', author: 'Frank Herbert' },
      }],
      fetchLibrary,
      isLoading: false,
    });
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'Criar clube' })[0]);

    expect(screen.getByRole('dialog', { name: 'Criar clube de leitura' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do clube/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Livro/i })).toHaveTextContent('Duna — Frank Herbert');
  });
});
