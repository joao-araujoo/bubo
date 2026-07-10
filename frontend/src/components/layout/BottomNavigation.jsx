import React from 'react';
import { BookOpen, Compass, Home, MessageSquare, UserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Início', Icon: Home, end: true },
  { to: '/library', label: 'Biblioteca', Icon: BookOpen },
  { to: '/feed', label: 'Feed', Icon: MessageSquare },
  { to: '/discover', label: 'Descobrir', Icon: Compass },
  { to: '/profile', label: 'Perfil', Icon: UserRound },
];

export default function BottomNavigation() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 rounded-[1.25rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.96)] p-1.5 shadow-[var(--bubo-shadow-lg)] backdrop-blur-xl">
        {items.map(({ Icon, end, label, to }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--bubo-radius-md)] px-1 text-[0.68rem] font-semibold transition ${
                isActive
                  ? 'bg-[rgb(var(--bubo-color-primary)/0.12)] text-[rgb(var(--bubo-color-primary))]'
                  : 'text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))]'
              }`
            }
          >
            <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
