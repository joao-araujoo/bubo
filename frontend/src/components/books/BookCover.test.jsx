import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BookCover from './BookCover';

describe('BookCover', () => {
  it('renders the provided cover image', () => {
    render(
      <BookCover
        title="Duna"
        author="Frank Herbert"
        src="https://example.com/duna.jpg"
      />,
    );

    expect(screen.getByRole('img', { name: 'Capa de Duna' })).toHaveAttribute(
      'src',
      'https://example.com/duna.jpg',
    );
  });

  it('switches to the branded fallback when the image fails', () => {
    render(
      <BookCover
        title="Duna"
        author="Frank Herbert"
        src="https://example.com/invalid.jpg"
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Capa de Duna' }));

    expect(screen.getByRole('img', { name: 'Capa indisponível de Duna' })).toBeInTheDocument();
    expect(screen.getByText('Duna')).toBeInTheDocument();
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();
  });

  it('uses the fallback immediately when no image exists', () => {
    render(<BookCover title="Livro sem capa" author="Autor desconhecido" />);

    expect(
      screen.getByRole('img', { name: 'Capa indisponível de Livro sem capa' }),
    ).toBeInTheDocument();
  });
});
