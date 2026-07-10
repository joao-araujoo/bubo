import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProgressBar from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes progress values to assistive technologies', () => {
    render(<ProgressBar label="Meta anual" value={3} max={20} showValue />);

    const progress = screen.getByRole('progressbar', { name: 'Meta anual' });
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '20');
    expect(progress).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByText('3 / 20')).toBeInTheDocument();
  });

  it('clamps values that exceed the maximum', () => {
    render(<ProgressBar label="Profundidade" value={140} max={100} showValue />);

    expect(screen.getByRole('progressbar', { name: 'Profundidade' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100 / 100')).toBeInTheDocument();
  });

  it('normalizes negative values to zero', () => {
    render(<ProgressBar label="Progresso" value={-5} max={10} />);

    expect(screen.getByRole('progressbar', { name: 'Progresso' })).toHaveAttribute('aria-valuenow', '0');
  });
});
