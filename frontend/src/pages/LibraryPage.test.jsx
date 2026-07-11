import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LibraryPage from './LibraryPage';
import { useLibraryStore } from '../stores/useLibraryStore';

vi.mock('../stores/useLibraryStore', () => ({
  useLibraryStore: vi.fn(),
}));

const toReadBook = {
  _id: 'user-book-1',
  status: 'to-read',
  currentPage: 0,
  totalPagesOverride: 0,
  addedAt: '2026-07-11T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  bookId: {
    _id: 'book-1',
    title: 'Torto Arado',
    author: 'Itamar Vieira Junior',
    coverImage: 'https://example.com/torto-arado.jpg',
    totalPages: 264,
  },
};

const renderPage = () => render(
  <BrowserRouter>
    <LibraryPage />
  </BrowserRouter>,
);

describe('LibraryPage', () => {
  const fetchLibrary = vi.fn().mockResolvedValue([toReadBook]);
  const updateBookStatus = vi.fn().mockResolvedValue({ ...toReadBook, status: 'reading' });

  beforeEach(() => {
    vi.clearAllMocks();
    useLibraryStore.mockReturnValue({
      books: [toReadBook],
      error: null,
      fetchLibrary,
      isLoading: false,
      updateBookStatus,
      updatingIds: [],
      removeBook: vi.fn(),
    });
  });

  it('lets the reader start a saved book directly from its card', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));

    await waitFor(() => expect(updateBookStatus).toHaveBeenCalledWith('user-book-1', { status: 'reading' }));
  });

  it('opens a complete management modal from the book card', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Gerenciar Torto Arado' }));

    expect(screen.getByRole('dialog', { name: 'Gerenciar leitura' })).toBeInTheDocument();
    expect(screen.getByLabelText('Páginas da minha edição')).toHaveValue(264);
    expect(screen.getByLabelText('Página atual')).toHaveValue(0);
    expect(screen.getByRole('button', { name: 'Começar leitura' })).toBeInTheDocument();
  });
});
