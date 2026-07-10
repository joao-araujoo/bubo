import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DeepReviewResult from './DeepReviewResult';

const approvedResult = {
  state: 'APPROVED',
  cognitiveDepth: 82,
  criteria: {
    comprehension: 22,
    specificity: 18,
    connections: 21,
    reflection: 21,
  },
  feedback: 'A síntese apresenta relações claras e uma interpretação própria.',
  encouragement: 'Continue transformando leitura em conexão.',
  strengths: ['Boa conexão entre causas e consequências.'],
  nextSteps: ['Inclua mais uma evidência concreta do trecho.'],
  socraticQuestion: 'O que mudaria se a decisão principal tivesse outra causa?',
  retentionPrompt: 'Qual evidência sustenta sua interpretação central?',
  meta: {
    provider: 'openai',
    degraded: false,
  },
};

describe('DeepReviewResult', () => {
  it('shows dimensions, guidance and provider transparency', () => {
    render(<DeepReviewResult result={approvedResult} onSaveProgress={vi.fn()} />);

    expect(screen.getByText('Aprovada')).toBeInTheDocument();
    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('Compreensão')).toBeInTheDocument();
    expect(screen.getByText('Especificidade')).toBeInTheDocument();
    expect(screen.getByText(approvedResult.socraticQuestion)).toBeInTheDocument();
    expect(screen.getByText(approvedResult.retentionPrompt)).toBeInTheDocument();
  });

  it('allows the reader to confirm an approved result', () => {
    const onSaveProgress = vi.fn();
    render(<DeepReviewResult result={approvedResult} onSaveProgress={onSaveProgress} />);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar progresso' }));

    expect(onSaveProgress).toHaveBeenCalledTimes(1);
  });

  it('identifies a local fallback without showing a save action for guiding results', () => {
    render(
      <DeepReviewResult
        result={{
          ...approvedResult,
          state: 'GUIDING',
          cognitiveDepth: 0,
          meta: { provider: 'local', degraded: true },
        }}
        onSaveProgress={vi.fn()}
      />,
    );

    expect(screen.getByText('Vamos aprofundar')).toBeInTheDocument();
    expect(screen.getByText('fallback local')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar progresso' })).not.toBeInTheDocument();
  });
});
