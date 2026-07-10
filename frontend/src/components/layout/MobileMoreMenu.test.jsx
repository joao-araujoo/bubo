import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import MobileMoreMenu from './MobileMoreMenu';

const renderMenu = () => render(
  <MemoryRouter>
    <MobileMoreMenu />
  </MemoryRouter>,
);

describe('MobileMoreMenu', () => {
  it('opens advanced areas without adding more bottom-navigation items', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Abrir menu de recursos' });
    fireEvent.click(trigger);

    expect(screen.getByRole('menu', { name: 'Mais recursos' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Clubes de leitura/i })).toHaveAttribute('href', '/clubs');
    expect(screen.getByRole('menuitem', { name: /AI Reading Coach/i })).toHaveAttribute('href', '/coach');
    expect(screen.getByRole('menuitem', { name: /Conquistas/i })).toHaveAttribute('href', '/achievements');
  });

  it('closes when Escape is pressed', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de recursos' }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Mais recursos' })).not.toBeInTheDocument();
  });
});
