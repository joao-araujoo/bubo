import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  <MemoryRouter initialEntries={['/library']}>
    <Routes>
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/library/:id" element={<h1>Espaço individual da leitura</h1>} />
    </Routes>
  </MemoryRouter>,
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
    });
  });

  it('starts a saved book and continues into its individual reading workspace', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));

    await waitFor(() => expect(updateBookStatus).toHaveBeenCalledWith('user-book-1', { status: 'reading' }));
    expect(await screen.findByRole('heading', { name: 'Espaço individual da leitura' })).toBeInTheDocument();
  });

  it('exposes the individual workspace directly from the book card', () => {
    renderPage();

    const readingLinks = screen.getAllByRole('link').filter((link) => (
      link.getAttribute('href') === '/library/user-book-1'
    ));

    expect(readingLinks.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Gerenciar Torto Arado/i })).not.toBeInTheDocument();
  });
});
