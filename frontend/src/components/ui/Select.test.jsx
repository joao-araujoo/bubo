import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Select from './Select';

function ControlledSelect({ onChange = () => {} }) {
  const [value, setValue] = useState('free');
  return (
    <Select
      label="Tipo de publicação"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onChange(event.target.value);
      }}
    >
      <option value="free">Post livre</option>
      <option value="review">Insight de Deep Review</option>
      <option value="challenge">Progresso em desafio</option>
    </Select>
  );
}

describe('Select', () => {
  it('renders the selected option and changes it from the styled listbox', () => {
    const onChange = vi.fn();
    render(<ControlledSelect onChange={onChange} />);

    const trigger = screen.getByRole('combobox', { name: 'Tipo de publicação' });
    expect(trigger).toHaveTextContent('Post livre');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Insight de Deep Review' }));

    expect(onChange).toHaveBeenCalledWith('review');
    expect(trigger).toHaveTextContent('Insight de Deep Review');
  });

  it('supports keyboard navigation', () => {
    const onChange = vi.fn();
    render(<ControlledSelect onChange={onChange} />);

    const trigger = screen.getByRole('combobox', { name: 'Tipo de publicação' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('review');
  });

  it('shows descriptions and error messages accessibly', () => {
    render(
      <Select label="Status" value="reading" description="Escolha o estado do livro" error="Status inválido">
        <option value="reading">Lendo</option>
      </Select>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Status inválido');
    expect(screen.queryByText('Escolha o estado do livro')).not.toBeInTheDocument();
  });
});
