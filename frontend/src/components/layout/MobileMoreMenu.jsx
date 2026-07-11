import React, { useEffect, useRef, useState } from 'react';
import { Brain, Menu, Trophy, UsersRound, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  {
    to: '/clubs',
    label: 'Clubes de leitura',
    description: 'Leia e discuta em comunidade.',
    Icon: UsersRound,
  },
  {
    to: '/coach',
    label: 'AI Reading Coach',
    description: 'Acompanhe seu mapa cognitivo.',
    Icon: Brain,
  },
  {
    to: '/achievements',
    label: 'Conquistas',
    description: 'Veja badges, metas e evolução.',
    Icon: Trophy,
  },
];

export default function MobileMoreMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const firstLinkRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    firstLinkRef.current?.focus();
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative hidden md:block lg:hidden" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))]"
        aria-label={isOpen ? 'Fechar menu de recursos' : 'Abrir menu de recursos'}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Mais recursos"
          className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-2rem))] rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-2 shadow-[var(--bubo-shadow-lg)]"
        >
          <p className="px-3 pb-2 pt-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-text-muted))]">Mais no Bubo</p>
          {items.map(({ Icon, description, label, to }, index) => (
            <NavLink
              key={to}
              ref={index === 0 ? firstLinkRef : undefined}
              to={to}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `flex items-start gap-3 rounded-[var(--bubo-radius-md)] p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${isActive ? 'bg-[rgb(var(--bubo-color-primary)/0.09)]' : 'hover:bg-[rgb(var(--bubo-color-surface-muted))]'}`}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-sm">{label}</strong>
                <span className="mt-1 block text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">{description}</span>
              </span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
