import React, { useState } from 'react';
import { ArrowRight, Brain, Library, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BuboMark from '../components/brand/BuboMark';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { useAuthStore } from '../stores/useAuthStore';

const benefits = [
  { title: 'Acervo vivo', description: 'Organize leituras, progresso e histórico em um só lugar.', Icon: Library },
  { title: 'Memória validada', description: 'Transforme páginas lidas em sínteses que realmente permanecem.', Icon: Brain },
  { title: 'IA socrática', description: 'Receba perguntas e feedback sem terceirizar seu pensamento.', Icon: Sparkles },
];

export default function AuthPage() {
  const navigate = useNavigate();
  const { clearError, error, isLoading, login, register } = useAuthStore();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  const update = (field) => (event) => {
    clearError();
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.username, form.email, form.password);
      navigate('/');
    } catch {
      // O store expõe a mensagem de erro para a interface.
    }
  };

  const changeMode = (nextMode) => {
    clearError();
    setMode(nextMode);
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_0.82fr]">
      <section className="hidden lg:block">
        <div className="flex items-center gap-3"><BuboMark size={54} /><div><strong className="block text-xl font-black">Bubo</strong><span className="text-xs font-extrabold uppercase tracking-[0.25em] text-[rgb(var(--bubo-color-primary))]">Read deeply</span></div></div>
        <h1 className="mt-8 max-w-xl text-5xl font-black leading-[1.04] tracking-[-0.05em]">Sua leitura merece virar <span className="text-[rgb(var(--bubo-color-primary))]">memória.</span></h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[rgb(var(--bubo-color-text-muted))]">Entre no Bubo para registrar progresso, validar sínteses e construir uma trajetória literária mais consciente.</p>
        <div className="mt-8 grid gap-4">{benefits.map(({ Icon, description, title }) => <div key={title} className="flex max-w-xl gap-4"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Icon size={21} /></span><div><h2 className="font-extrabold">{title}</h2><p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{description}</p></div></div>)}</div>
      </section>

      <Card padding="lg" className="mx-auto w-full max-w-md">
        <div className="lg:hidden"><BuboMark size={48} /></div>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Bem-vindo</p>
        <h1 className="mt-1 text-3xl font-black">{mode === 'login' ? 'Continue sua leitura' : 'Crie sua jornada'}</h1>
        <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{mode === 'login' ? 'Acesse seu acervo, reviews e progresso.' : 'Comece seu acervo e faça sua primeira Deep Review.'}</p>

        <div className="mt-6 grid grid-cols-2 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-1" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')} className={`min-h-10 rounded-[calc(var(--bubo-radius-md)-0.2rem)] text-sm font-bold transition ${mode === 'login' ? 'bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text))] shadow-[var(--bubo-shadow-sm)]' : 'text-[rgb(var(--bubo-color-text-muted))]'}`}>Entrar</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')} className={`min-h-10 rounded-[calc(var(--bubo-radius-md)-0.2rem)] text-sm font-bold transition ${mode === 'register' ? 'bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text))] shadow-[var(--bubo-shadow-sm)]' : 'text-[rgb(var(--bubo-color-text-muted))]'}`}>Criar conta</button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === 'register' && <Input label="Nome de usuário" value={form.username} onChange={update('username')} autoComplete="username" required />}
          <Input label="E-mail" type="email" value={form.email} onChange={update('email')} autoComplete="email" required />
          <Input label="Senha" type="password" value={form.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required />
          {error && <div className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-danger)/0.28)] bg-[rgb(var(--bubo-color-danger)/0.08)] px-3 py-2.5 text-sm text-[rgb(var(--bubo-color-danger))]" role="alert">{error}</div>}
          <Button type="submit" className="w-full" isLoading={isLoading} rightIcon={<ArrowRight size={17} />}>{mode === 'login' ? 'Entrar no Bubo' : 'Criar minha conta'}</Button>
        </form>
      </Card>
    </div>
  );
}
