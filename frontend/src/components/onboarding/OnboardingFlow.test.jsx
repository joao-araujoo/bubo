import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/useAuthStore';
import OnboardingFlow from './OnboardingFlow';

const updateProfile = vi.fn();

beforeEach(() => {
  updateProfile.mockReset();
  updateProfile.mockResolvedValue({ onboardingCompleted: true });
  useAuthStore.setState({
    user: {
      username: 'João',
      readingGoal: 20,
      onboardingCompleted: false,
      readingPreferences: {
        primaryGoal: 'retain',
        pace: 'steady',
        favoriteGenres: [],
        weeklyReviewTarget: 2,
      },
    },
    updateProfile,
    isLoading: false,
    error: null,
  });
});

describe('OnboardingFlow', () => {
  it('starts with an accessible purpose selection', () => {
    render(<OnboardingFlow />);

    expect(screen.getByRole('heading', { name: 'O que você quer transformar na sua leitura?' })).toHaveFocus();
    expect(screen.getByRole('radiogroup', { name: 'Objetivo principal' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Lembrar o que leio/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('can finish later without leaving the account trapped in onboarding', async () => {
    render(<OnboardingFlow />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurar depois' }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      onboardingCompleted: true,
      readingGoal: 20,
      readingPreferences: expect.objectContaining({
        primaryGoal: 'retain',
        pace: 'steady',
        weeklyReviewTarget: 2,
      }),
    })));
  });

  it('moves through the goal and pace steps with semantic radio state', () => {
    render(<OnboardingFlow />);

    fireEvent.click(screen.getByRole('radio', { name: /Pensar com mais profundidade/i }));
    expect(screen.getByRole('radio', { name: /Pensar com mais profundidade/i })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByRole('heading', { name: 'Como a leitura cabe na sua rotina?' })).toHaveFocus();

    fireEvent.click(screen.getByRole('radio', { name: /Intensivo/i }));
    expect(screen.getByRole('radio', { name: /Intensivo/i })).toHaveAttribute('aria-checked', 'true');
  });
});
