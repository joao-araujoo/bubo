import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  it('renders its accessible label', () => {
    render(<Button>Salvar leitura</Button>);

    expect(screen.getByRole('button', { name: 'Salvar leitura' })).toBeInTheDocument();
  });

  it('calls the click handler when enabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continuar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks interaction and exposes loading state', () => {
    const onClick = vi.fn();
    render(<Button isLoading onClick={onClick}>Validar</Button>);

    const button = screen.getByRole('button', { name: 'Validar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('supports rendering as a navigation link', () => {
    render(<Button as="a" href="/library">Abrir biblioteca</Button>);

    expect(screen.getByRole('link', { name: 'Abrir biblioteca' })).toHaveAttribute('href', '/library');
  });
});
