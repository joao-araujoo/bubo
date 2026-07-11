import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClubDetailPage from './ClubDetailPage';
import { useClubStore } from '../stores/useClubStore';

vi.mock('../stores/useClubStore', () => ({
  useClubStore: vi.fn(),
}));

const baseClub = {
  _id: 'club-1',
  name: 'Expedição por Arrakis',
  description: 'Uma leitura coletiva de Duna.',
  visibility: 'public',
  memberLimit: 30,
  targetDate: '2026-12-20T00:00:00.000Z',
  book: {
    _id: 'catalog-book-1',
    title: 'Duna',
    author: 'Frank Herbert',
    totalPages: 412,
    coverImage: '',
  },
  libraryEntry: {
    _id: 'user-book-1',
    status: 'reading',
    currentPage: 80,
  },
  membership: {
    _id: 'membership-1',
    role: 'member',
    currentPage: 80,
  },
  stats: {
    memberCount: 2,
    averagePage: 90,
    progressPercentage: 22,
    discussionsCount: 0,
  },
  members: [
    {
      _id: 'membership-owner',
      role: 'owner',
      currentPage: 100,
      user: { _id: 'owner-1', username: 'Ana', avatar: '' },
    },
    {
      _id: 'membership-1',
      role: 'member',
      currentPage: 80,
      isCurrentUser: true,
      user: { _id: 'user-1', username: 'João', avatar: '' },
    },
  ],
  discussions: [],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/clubs/club-1']}>
    <Routes>
      <Route path="/clubs/:id" element={<ClubDetailPage />} />
      <Route path="/clubs" element={<h1>Lista de clubes</h1>} />
      <Route path="/library/:id" element={<h1>Leitura individual</h1>} />
    </Routes>
  </MemoryRouter>,
);

describe('ClubDetailPage', () => {
  const clearActiveClub = vi.fn();
  const createDiscussion = vi.fn().mockResolvedValue(undefined);
  const fetchClub = vi.fn().mockResolvedValue(baseClub);
  const joinClub = vi.fn().mockResolvedValue(baseClub);
  const leaveClub = vi.fn().mockResolvedValue(undefined);
  const updateProgress = vi.fn().mockResolvedValue(baseClub);

  const setClubStore = (overrides = {}) => {
    useClubStore.mockReturnValue({
      activeClub: baseClub,
      clearActiveClub,
      createDiscussion,
      error: null,
      errorCode: null,
      fetchClub,
      isLoading: false,
      isMutating: false,
      joinClub,
      leaveClub,
      updateProgress,
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setClubStore();
  });

  it('focuses the contribution editor from the empty discussion state', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Escrever contribuição' }));

    expect(screen.getByLabelText(/Contribuição/i)).toHaveFocus();
  });

  it('blocks an incomplete page range before calling the API', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/Contribuição/i), { target: { value: 'Uma interpretação para o grupo.' } });
    fireEvent.change(screen.getByLabelText(/Página inicial/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar no clube' }));

    expect(createDiscussion).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/página inicial e a página final/i);
  });

  it('uses the design-system confirmation before leaving the club', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Sair do clube' }));
    expect(screen.getByRole('dialog', { name: 'Sair deste clube?' })).toBeInTheDocument();
    expect(leaveClub).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sair do clube' }));

    await waitFor(() => expect(leaveClub).toHaveBeenCalledWith('club-1'));
    expect(await screen.findByRole('heading', { name: 'Lista de clubes' })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('shows a persistent invite dialog with copyable code and link', () => {
    setClubStore({
      activeClub: {
        ...baseClub,
        visibility: 'private',
        inviteCode: 'ABCD1234',
        membership: { ...baseClub.membership, role: 'owner' },
      },
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar convite' }));

    expect(screen.getByRole('dialog', { name: 'Convite do clube' })).toBeInTheDocument();
    expect(screen.getAllByText('ABCD1234').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Link de convite')).toHaveValue(expect.stringContaining('/clubs/club-1?invite=ABCD1234'));
  });
});
