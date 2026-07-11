import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookHeart, Brain, Check, Gauge, Sparkles, Target, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useAuthStore';
import BuboMark from '../brand/BuboMark';
import Button from '../ui/Button';
import Input from '../ui/Input';

const goals = [
  {
    id: 'retain',
    title: 'Lembrar o que leio',
    description: 'Transformar páginas em memórias que sobrevivem ao tempo.',
    Icon: Brain,
  },
  {
    id: 'reflect',
    title: 'Pensar com mais profundidade',
    description: 'Criar conexões, perguntas e interpretações próprias.',
    Icon: Sparkles,
  },
  {
    id: 'consistency',
    title: 'Construir consistência',
    description: 'Manter um ritmo sustentável e concluir mais leituras.',
    Icon: Target,
  },
  {
    id: 'community',
    title: 'Ler em comunidade',
    description: 'Trocar ideias e participar de clubes com outros leitores.',
    Icon: UsersRound,
  },
];

const paces = [
  {
    id: 'casual',
    title: 'Casual',
    description: 'Uma leitura sem pressão, quando houver espaço.',
    weeklyReviewTarget: 1,
  },
  {
    id: 'steady',
    title: 'Constante',
    description: 'Um ritmo equilibrado para criar hábito e memória.',
    weeklyReviewTarget: 2,
  },
  {
    id: 'intensive',
    title: 'Intensivo',
    description: 'Leitura frequente, metas altas e acompanhamento próximo.',
    weeklyReviewTarget: 4,
  },
];

const genres = [
  'Ficção literária',
  'Fantasia',
  'Ficção científica',
  'Romance',
  'Mistério',
  'História',
  'Filosofia',
  'Psicologia',
  'Ciência',
  'Biografia',
  'Negócios',
  'Poesia',
];

const stepCopy = [
  { eyebrow: 'Seu propósito', title: 'O que você quer transformar na sua leitura?' },
  { eyebrow: 'Seu ritmo', title: 'Como a leitura cabe na sua rotina?' },
  { eyebrow: 'Seu repertório', title: 'Quais universos mais chamam sua atenção?' },
  { eyebrow: 'Seu compromisso', title: 'Defina metas que você consiga sustentar.' },
];

export default function OnboardingFlow() {
  const { updateProfile, user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    primaryGoal: user?.readingPreferences?.primaryGoal || 'retain',
    pace: user?.readingPreferences?.pace || 'steady',
    favoriteGenres: user?.readingPreferences?.favoriteGenres || [],
    weeklyReviewTarget: user?.readingPreferences?.weeklyReviewTarget || 2,
    readingGoal: user?.readingGoal || 20,
  });
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const selectedPace = useMemo(
    () => paces.find((pace) => pace.id === form.pace) || paces[1],
    [form.pace],
  );

  const selectPace = (pace) => {
    setForm((current) => ({
      ...current,
      pace: pace.id,
      weeklyReviewTarget: pace.weeklyReviewTarget,
    }));
  };

  const toggleGenre = (genre) => {
    setForm((current) => {
      const selected = current.favoriteGenres.includes(genre);
      if (selected) {
        return {
          ...current,
          favoriteGenres: current.favoriteGenres.filter((item) => item !== genre),
        };
      }
      if (current.favoriteGenres.length >= 6) {
        toast('Escolha até 6 gêneros para manter seu perfil focado.');
        return current;
      }
      return {
        ...current,
        favoriteGenres: [...current.favoriteGenres, genre],
      };
    });
  };

  const finish = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        readingGoal: Number(form.readingGoal),
        readingPreferences: {
          primaryGoal: form.primaryGoal,
          pace: form.pace,
          favoriteGenres: form.favoriteGenres,
          weeklyReviewTarget: Number(form.weeklyReviewTarget),
        },
        onboardingCompleted: true,
      });
      toast.success('Seu Bubo foi personalizado.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const continueFlow = () => {
    if (step === 2 && form.favoriteGenres.length === 0) {
      toast('Escolha ao menos um gênero ou avance usando “Configurar depois”.');
      return;
    }
    if (step < stepCopy.length - 1) setStep((current) => current + 1);
    else finish();
  };

  const configureLater = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        readingGoal: Number(form.readingGoal),
        readingPreferences: {
          primaryGoal: form.primaryGoal,
          pace: form.pace,
          favoriteGenres: form.favoriteGenres,
          weeklyReviewTarget: Number(form.weeklyReviewTarget),
        },
        onboardingCompleted: true,
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[rgb(var(--bubo-color-background))] text-[rgb(var(--bubo-color-text))]">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BuboMark size={46} />
            <div>
              <strong className="block text-lg font-black">Bubo</strong>
              <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.25em] text-[rgb(var(--bubo-color-primary))]">Read deeply</span>
            </div>
          </div>
          <button
            type="button"
            onClick={configureLater}
            disabled={isSaving}
            className="min-h-10 rounded-full px-3 text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))] disabled:opacity-50"
          >
            Configurar depois
          </button>
        </header>

        <div className="mt-7 flex items-center gap-2" aria-label={`Etapa ${step + 1} de ${stepCopy.length}`}>
          {stepCopy.map((item, index) => (
            <span
              key={item.eyebrow}
              className={`h-1.5 flex-1 rounded-full transition ${index <= step ? 'bg-[rgb(var(--bubo-color-primary))]' : 'bg-[rgb(var(--bubo-color-border))]'}`}
            />
          ))}
        </div>

        <main className="flex flex-1 items-center py-8 sm:py-12">
          <section className="mx-auto w-full max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">
              {stepCopy[step].eyebrow} · {step + 1}/{stepCopy.length}
            </p>
            <h1
              ref={headingRef}
              tabIndex="-1"
              className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.035em] outline-none sm:text-5xl"
            >
              {stepCopy[step].title}
            </h1>

            {step === 0 && (
              <div className="mt-8 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Objetivo principal">
                {goals.map(({ Icon, description, id, title }) => {
                  const selected = form.primaryGoal === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setForm((current) => ({ ...current, primaryGoal: id }))}
                      className={`relative min-h-36 rounded-[var(--bubo-radius-lg)] border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${selected ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary)/0.08)] shadow-[var(--bubo-shadow-md)]' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] hover:border-[rgb(var(--bubo-color-primary)/0.4)]'}`}
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <strong className="mt-4 block">{title}</strong>
                      <span className="mt-1 block text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{description}</span>
                      {selected && <Check className="absolute right-4 top-4 text-[rgb(var(--bubo-color-primary))]" size={19} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}

            {step === 1 && (
              <div className="mt-8 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Ritmo de leitura">
                {paces.map((pace) => {
                  const selected = form.pace === pace.id;
                  return (
                    <button
                      key={pace.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectPace(pace)}
                      className={`min-h-48 rounded-[var(--bubo-radius-lg)] border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${selected ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary)/0.08)] shadow-[var(--bubo-shadow-md)]' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] hover:border-[rgb(var(--bubo-color-primary)/0.4)]'}`}
                    >
                      <Gauge size={22} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
                      <strong className="mt-5 block text-lg">{pace.title}</strong>
                      <span className="mt-2 block text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{pace.description}</span>
                      <span className="mt-4 block text-xs font-extrabold uppercase tracking-[0.1em] text-[rgb(var(--bubo-color-primary))]">
                        {pace.weeklyReviewTarget} review{pace.weeklyReviewTarget > 1 ? 's' : ''}/semana
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="mt-8">
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => {
                    const selected = form.favoriteGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleGenre(genre)}
                        className={`min-h-11 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${selected ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] hover:border-[rgb(var(--bubo-color-primary)/0.4)] hover:text-[rgb(var(--bubo-color-text))]'}`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-5 text-sm text-[rgb(var(--bubo-color-text-muted))]">
                  {form.favoriteGenres.length}/6 selecionados. Isso ajudará a personalizar descobertas futuras.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-5">
                  <BookHeart size={22} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
                  <Input
                    className="mt-5"
                    label="Livros por ano"
                    type="number"
                    min="1"
                    max="365"
                    value={form.readingGoal}
                    onChange={(event) => setForm((current) => ({ ...current, readingGoal: event.target.value }))}
                    description="Uma direção, não uma cobrança. Você poderá alterar depois."
                  />
                </div>
                <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-5">
                  <Brain size={22} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
                  <Input
                    className="mt-5"
                    label="Deep Reviews por semana"
                    type="number"
                    min="1"
                    max="14"
                    value={form.weeklyReviewTarget}
                    onChange={(event) => setForm((current) => ({ ...current, weeklyReviewTarget: event.target.value }))}
                    description={`Ritmo ${selectedPace.title.toLowerCase()}, ajustável à sua rotina.`}
                  />
                </div>
                <div className="sm:col-span-2 rounded-[var(--bubo-radius-lg)] bg-[rgb(var(--bubo-color-primary)/0.07)] p-5">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">Seu Bubo inicial</p>
                  <p className="mt-2 leading-7">
                    O app priorizará <strong>{goals.find((goal) => goal.id === form.primaryGoal)?.title.toLowerCase()}</strong>, com ritmo <strong>{selectedPace.title.toLowerCase()}</strong>{form.favoriteGenres.length > 0 ? ` e repertório focado em ${form.favoriteGenres.slice(0, 3).join(', ')}` : ''}.
                  </p>
                </div>
              </div>
            )}
          </section>
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-[rgb(var(--bubo-color-border))] pt-5">
          <Button
            variant="ghost"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || isSaving}
            leftIcon={<ArrowLeft size={17} aria-hidden="true" />}
          >
            Voltar
          </Button>
          <Button
            onClick={continueFlow}
            isLoading={isSaving}
            rightIcon={step === stepCopy.length - 1 ? <Check size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          >
            {step === stepCopy.length - 1 ? 'Começar a ler' : 'Continuar'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
