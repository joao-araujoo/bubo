import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  getActivityLabel,
  getBookStatusLabel,
} from './formatters';

describe('product formatters', () => {
  it('formats numbers using Brazilian grouping', () => {
    expect(formatNumber(12345)).toBe('12.345');
    expect(formatNumber(undefined)).toBe('0');
  });

  it('returns localized book status labels', () => {
    expect(getBookStatusLabel('reading')).toBe('Lendo');
    expect(getBookStatusLabel('to-read')).toBe('Quero ler');
    expect(getBookStatusLabel('read')).toBe('Lido');
    expect(getBookStatusLabel('abandoned')).toBe('Abandonado');
    expect(getBookStatusLabel('unknown')).toBe('Sem status');
  });

  it('returns contextual social activity labels', () => {
    expect(getActivityLabel('review_approved')).toBe('Deep Review validada');
    expect(getActivityLabel('achievement_unlocked')).toBe('Conquista desbloqueada');
    expect(getActivityLabel('post', 'review')).toBe('Insight de Deep Review');
    expect(getActivityLabel('post', 'challenge')).toBe('Progresso em desafio');
    expect(getActivityLabel('post', 'free')).toBe('Post livre');
  });
});
