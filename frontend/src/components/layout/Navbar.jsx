import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BookOpen, Brain, Compass, Home, MessageSquare, Sparkles, Trophy, UserRound, UsersRound } from 'lucide-react';
import BuboMark from '../brand/BuboMark';
import NotificationBell from '../social/NotificationBell';
import Button from '../ui/Button';
import ThemeToggle from '../theme/ThemeToggle';
import { useAuthStore } from '../../stores/useAuthStore';

const pageTitles = {
  '/': 'Início',
  '/library': 'Biblioteca',
  '/feed': 'Feed',
  '/discover': 'Descobrir',
  '/clubs': 'Clubes',
  '/coach': 'Coach',
  '/achievements': 'Conquistas',
  '/profile': 'Perfil',
};

const desktopLinks = [
  { to: '/', label: 'Início', Icon: Home, end: true },
  { to: '/library', label: 'Biblioteca', Icon: BookOpen },
  { to: '/feed', label: 'Feed', Icon: MessageSquare },
  { to: '/discover', label: 'Descobrir', Icon: Compass },
  { to: '/clubs', label: 'Clubes', Icon: UsersRound },
  { to: '/coach', label: 'Coach', Icon: Brain },
  { to: '/achievements', label: 'Conquistas', Icon: Trophy },
  { to: '/profile', label: 'Perfil', Icon: UserRound },
];

export default function Navbar() {
  const location = useLocation();
  const { token } = useAuthStore();
  const title = location.pathname.startsWith('/clubs/')
    ? 'Clube de leitura'
    : pageTitles[location.pathname] ?? 'Bubo';

  const openDeepReview = () => {
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review'));
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.94)] backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none">
          <BuboMark size={42} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold leading-tight text-[rgb(var(--bubo-color-text))] sm:text-base">{title}</span>
            <span className="block text-[0.62rem] font-extrabold uppercase tracking-[0.28em] text-[rgb(var(--bubo-color-primary))]">Read deeply</span>
          </span>
        </Link>

        {token && (
          <nav aria-label="Navegação desktop" className="ml-5 hidden flex-1 items-center gap-1 lg:flex">
            {desktopLinks.map(({ Icon, end, label, to }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex min-h-10 items-center gap-2 rounded-[var(--bubo-radius-md)] px-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[rgb(var(--bubo-color-primary)/0.12)] text-[rgb(var(--bubo-color-primary))]'
                      : 'text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))]'
                  }`
                }
              >
                <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
                <span className="hidden xl:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {token ? (
            <>
              <NotificationBell />
              <Button size="md" leftIcon={<Sparkles size={17} aria-hidden="true" />} onClick={openDeepReview}>
                Validar
              </Button>
            </>
          ) : (
            <Link
              to="/auth"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-primary))] px-4 text-sm font-semibold text-[rgb(var(--bubo-color-primary-contrast))] shadow-[var(--bubo-shadow-sm)] transition hover:bg-[rgb(var(--bubo-color-primary-hover))]"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
