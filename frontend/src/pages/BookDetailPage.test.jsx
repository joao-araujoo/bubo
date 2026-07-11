import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookDetailPage from './BookDetailPage';
import api from '../services/api';
import { useLibraryStore } from '../stores/useLibraryStore';

vi.mock('../services/api', () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../stores/useLibraryStore', () => ({
  useLibraryStore: vi.fn(),
}));

const userBook = {
  _id: 'user-book-1',
  status: 'reading',
  currentPage: 120,
  effectiveTotalPages: 412,
  startedAt: '2026-07-01T12:00:00.000Z',
  bookId: {
    _id: 'book-1',
    title: 'Duna',
    author: 'Frank Herbert',
    coverImage: 'https://example.com/duna.jpg',
    totalPages: 412,
    publisher: 'Editora Exemplo',
  },
};

const detail = {
  userBook,
  sessions: [{
    _id: 'session-1',
    pageFrom: 101,
    pageTo: 120,
    pagesRead: 20,
    durationMinutes: 45,
    focus: 'high',
    note: 'A política ficou mais clara.',
    readAt: '2026-07-10T12:00:00.000Z',
  }],
  reviews: [{
    _id: 'review-1',
    pageFrom: 81,
    pageTo: 100,
    reviewText: 'Uma reflexão suficientemente detalhada para o histórico.',
    cognitiveDepth: 82,
    status: 'approved',
    wordCount: 130,
    createdAt: '2026-07-09T12:00:00.000Z',
  }],
  summary: {
    progressPercent: 29,
    sessionCount: 1,
    pagesReadInSessions: 20,
    durationMinutes: 45,
    averageDepth: 82,
  },
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/library/user-book-1']}>
        <Routes>
          <Route path="/library/:id" element={<BookDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('BookDetailPage', () => {
  const fetchLibrary = vi.fn().mockResolvedValue([userBook]);
  const removeBook = vi.fn().mockResolvedValue(undefined);
  const updateBookStatus = vi.fn().mockResolvedValue(userBook);

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: detail });
    useLibraryStore.mockReturnValue({
      books: [userBook],
      fetchLibrary,
      removeBook,
      updateBookStatus,
      updatingIds: [],
    });
    useLibraryStore.getState = vi.fn(() => ({ books: [userBook] }));
  });

  it('renders progress, sessions and Deep Reviews in the same reading context', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Duna' })).toBeInTheDocument();
    expect(screen.getByText('29%')).toBeInTheDocument();
    expect(screen.getByText('Páginas 101–120')).toBeInTheDocument();
    expect(screen.getByText('Páginas 81–100')).toBeInTheDocument();
    expect(screen.getAllByText('82/100')).toHaveLength(2);
    expect(api.get).toHaveBeenCalledWith('/books/library/user-book-1');
  });

  it('opens a dedicated reading session flow with the next page selected', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar sessão' }));

    const dialog = await screen.findByRole('dialog', { name: 'Registrar sessão de leitura' });
    const pageFromInput = await within(dialog).findByLabelText(/Página inicial/i);
    const pageToInput = await within(dialog).findByLabelText(/Página final/i);

    await waitFor(() => expect(pageFromInput).toHaveValue(121));
    expect(pageToInput).toHaveAttribute('max', '412');
  });
});
