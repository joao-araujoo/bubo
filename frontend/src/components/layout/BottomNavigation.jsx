import React, { useState } from 'react';
import {
  BookOpen,
  Brain,
  Compass,
  Home,
  Menu,
  MessageSquare,
  Moon,
  Sparkles,
  Sun,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
import Modal from '../ui/Modal';

const mainItems = [
  { to: '/', label: 'Início', Icon: Home, end: true },
  { to: '/library', label: 'Acervo', Icon: BookOpen },
  { to: '/feed', label: 'Feed', Icon: MessageSquare },
];

const moreItems = [
  { to: '/discover', label: 'Descobrir livros', description: 'Encontre sua próxima leitura.', Icon: Compass },
  { to: '/clubs', label: 'Clubes de leitura', description: 'Leia e discuta em comunidade.', Icon: UsersRound },
  { to: '/coach', label: 'AI Reading Coach', description: 'Acompanhe seu mapa cognitivo.', Icon: Brain },
  { to: '/achievements', label: 'Conquistas', description: 'Veja badges, metas e evolução.', Icon: Trophy },
  { to: '/profile', label: 'Perfil e configurações', description: 'Gerencie sua conta e preferências.', Icon: UserRound },
];

const morePaths = moreItems.map((item) => item.to);

export default function BottomNavigation() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isMoreActive = morePaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const isDark = theme === 'dark';

  const openDeepReview = () => {
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review'));
  };

  const navClass = ({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--bubo-radius-md)] px-1 text-[0.66rem] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${
    isActive
      ? 'bg-[rgb(var(--bubo-color-primary)/0.12)] text-[rgb(var(--bubo-color-primary))]'
      : 'text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))]'
  }`;

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end rounded-[1.25rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.97)] p-1.5 shadow-[var(--bubo-shadow-lg)] backdrop-blur-xl">
          <NavLink to={mainItems[0].to} end className={navClass}>
            <Home size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>Início</span>
          </NavLink>
          <NavLink to={mainItems[1].to} className={navClass}>
            <BookOpen size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>Acervo</span>
          </NavLink>

          <button
            type="button"
            onClick={openDeepReview}
            className="group -mt-5 flex min-h-[4.5rem] flex-col items-center justify-end gap-1 rounded-[var(--bubo-radius-lg)] text-[0.66rem] font-extrabold text-[rgb(var(--bubo-color-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))]"
            aria-label="Fazer Deep Review"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full border-4 border-[rgb(var(--bubo-color-surface))] bg-[rgb(var(--bubo-color-primary))] text-white shadow-[var(--bubo-shadow-md)] transition group-active:scale-95">
              <Sparkles size={21} strokeWidth={2} aria-hidden="true" />
            </span>
            <span>Validar</span>
          </button>

          <NavLink to={mainItems[2].to} className={navClass}>
            <MessageSquare size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>Feed</span>
          </NavLink>
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--bubo-radius-md)] px-1 text-[0.66rem] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${isMoreActive ? 'bg-[rgb(var(--bubo-color-primary)/0.12)] text-[rgb(var(--bubo-color-primary))]' : 'text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
            aria-expanded={isMoreOpen}
            aria-haspopup="dialog"
          >
            <Menu size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <Modal
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        size="sm"
        title="Mais no Bubo"
        description="Acesse todos os recursos sem perder a página atual."
      >
        <nav aria-label="Mais recursos" className="space-y-2">
          {moreItems.map(({ Icon, description, label, to }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setIsMoreOpen(false)}
              className={({ isActive }) => `flex min-h-16 items-center gap-3 rounded-[var(--bubo-radius-lg)] border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${isActive ? 'border-[rgb(var(--bubo-color-primary)/0.35)] bg-[rgb(var(--bubo-color-primary)/0.08)]' : 'border-[rgb(var(--bubo-color-border))] hover:bg-[rgb(var(--bubo-color-surface-muted))]'}`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <strong className="block text-sm">{label}</strong>
                <span className="mt-0.5 block text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">{description}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-[rgb(var(--bubo-color-border))] pt-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-14 w-full items-center gap-3 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] p-3 text-left transition hover:bg-[rgb(var(--bubo-color-surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))]"
            aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[rgb(var(--bubo-color-surface-muted))] text-[rgb(var(--bubo-color-text))]">
              {isDark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
            </span>
            <span>
              <strong className="block text-sm">{isDark ? 'Usar tema claro' : 'Usar tema escuro'}</strong>
              <span className="mt-0.5 block text-xs text-[rgb(var(--bubo-color-text-muted))]">A preferência fica salva neste dispositivo.</span>
            </span>
          </button>
        </div>
      </Modal>
    </>
  );
}
