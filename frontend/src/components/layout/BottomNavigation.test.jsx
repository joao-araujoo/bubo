import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BottomNavigation from './BottomNavigation';
import { useTheme } from '../../theme/ThemeProvider';

vi.mock('../../theme/ThemeProvider', () => ({
  useTheme: vi.fn(),
}));

const renderNavigation = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="*" element={<><BottomNavigation /><h1>Página atual</h1></>} />
    </Routes>
  </MemoryRouter>,
);

describe('BottomNavigation', () => {
  const toggleTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useTheme.mockReturnValue({ theme: 'light', toggleTheme });
  });

  it('keeps Deep Review as the central mobile action', () => {
    const listener = vi.fn();
    window.addEventListener('bubo:open-deep-review', listener);
    renderNavigation();

    fireEvent.click(screen.getByRole('button', { name: 'Fazer Deep Review' }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('bubo:open-deep-review', listener);
  });

  it('exposes all secondary destinations and theme control in the More panel', () => {
    renderNavigation();

    fireEvent.click(screen.getByRole('button', { name: 'Mais' }));

    expect(screen.getByRole('dialog', { name: 'Mais no Bubo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Descobrir livros/i })).toHaveAttribute('href', '/discover');
    expect(screen.getByRole('link', { name: /Clubes de leitura/i })).toHaveAttribute('href', '/clubs');
    expect(screen.getByRole('link', { name: /AI Reading Coach/i })).toHaveAttribute('href', '/coach');
    expect(screen.getByRole('link', { name: /Conquistas/i })).toHaveAttribute('href', '/achievements');
    expect(screen.getByRole('link', { name: /Perfil e configurações/i })).toHaveAttribute('href', '/profile');

    fireEvent.click(screen.getByRole('button', { name: 'Ativar tema escuro' }));
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });
});
