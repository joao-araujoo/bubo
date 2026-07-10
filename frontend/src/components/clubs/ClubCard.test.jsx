import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ClubCard from './ClubCard';

const publicClub = {
  _id: 'club-1',
  name: 'Expedição por Arrakis',
  description: 'Uma leitura coletiva de Duna.',
  visibility: 'public',
  isMember: false,
  membership: null,
  book: {
    title: 'Duna',
    author: 'Frank Herbert',
    totalPages: 412,
    coverImage: '',
  },
  stats: {
    memberCount: 12,
    discussionsCount: 8,
    averagePage: 138,
  },
};

function renderCard(club = publicClub, onJoin = vi.fn()) {
  return {
    onJoin,
    ...render(
      <MemoryRouter>
        <ClubCard club={club} onJoin={onJoin} />
      </MemoryRouter>,
    ),
  };
}

describe('ClubCard', () => {
  it('shows the associated book and community metrics', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Expedição por Arrakis' })).toBeInTheDocument();
    expect(screen.getAllByText('Duna')).toHaveLength(2);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('allows direct entry into public clubs', () => {
    const onJoin = vi.fn();
    renderCard(publicClub, onJoin);

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onJoin).toHaveBeenCalledWith(publicClub);
  });

  it('shows the member action without a duplicate join button', () => {
    renderCard({
      ...publicClub,
      isMember: true,
      membership: { role: 'member', currentPage: 32 },
    });

    expect(screen.getByRole('link', { name: 'Abrir clube' })).toHaveAttribute('href', '/clubs/club-1');
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
