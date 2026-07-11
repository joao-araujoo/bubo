import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DiscoverPage from './DiscoverPage';
import api from '../services/api';
import { useLibraryStore } from '../stores/useLibraryStore';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../stores/useLibraryStore', () => ({
  useLibraryStore: vi.fn(),
}));

const bookResult = {
  canonicalId: 'isbn:9788535910663',
  title: 'Dom Casmurro',
  author: 'Machado de Assis',
  coverImage: 'https://example.com/dom-casmurro.jpg',
  totalPages: 256,
  publishedDate: '1899',
};

const renderPage = (queryClient) => render(
  <QueryClientProvider client={queryClient}>
    <DiscoverPage />
  </QueryClientProvider>,
);

describe('DiscoverPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    useLibraryStore.mockReturnValue({
      addBook: vi.fn(),
      books: [],
      fetchLibrary: vi.fn().mockResolvedValue([]),
      updatingIds: [],
    });
    api.get.mockResolvedValue({ data: { books: [bookResult], meta: {} } });
  });

  it('does not search automatically when the page opens', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(queryClient);

    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByText('Qual livro você está procurando?')).toBeInTheDocument();
  });

  it('searches only after submit and reuses the React Query cache after navigation', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const firstRender = renderPage(queryClient);

    fireEvent.change(screen.getByPlaceholderText(/Torto Arado/i), { target: { value: 'Dom Casmurro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);

    firstRender.unmount();
    renderPage(queryClient);

    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  });
});
