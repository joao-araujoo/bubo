import React from 'react';
import { CalendarDays, Globe2, Lock, MessageSquare, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import BookCover from '../books/BookCover';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';

function formatTargetDate(value) {
  if (!value) return 'Sem prazo definido';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem prazo definido';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function ClubCard({ club, isJoining = false, onJoin }) {
  const book = club.book || {};
  const VisibilityIcon = club.visibility === 'private' ? Lock : Globe2;
  const canJoinDirectly = !club.isMember && club.visibility === 'public';

  return (
    <Card as="article" interactive className="flex h-full flex-col" padding="sm">
      <div className="grid grid-cols-[5.5rem_1fr] gap-4">
        <BookCover
          title={book.title || 'Livro do clube'}
          author={book.author}
          src={book.coverImage}
        />
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--bubo-color-surface-muted))] px-2.5 py-1 text-[0.68rem] font-bold text-[rgb(var(--bubo-color-text-muted))]">
              <VisibilityIcon size={13} aria-hidden="true" />
              {club.visibility === 'private' ? 'Privado' : 'Público'}
            </span>
            {club.membership?.role && (
              <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-2.5 py-1 text-[0.68rem] font-extrabold text-[rgb(var(--bubo-color-primary))]">
                {club.membership.role === 'owner' ? 'Owner' : club.membership.role === 'moderator' ? 'Moderador' : 'Membro'}
              </span>
            )}
          </div>
          <h2 className="mt-3 line-clamp-2 text-lg font-black leading-6">{club.name}</h2>
          <p className="mt-1 line-clamp-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.title || 'Livro não informado'}</p>
        </div>
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
        {club.description || 'Um espaço para avançar na leitura, compartilhar ideias e construir memória em conjunto.'}
      </p>

      <ProgressBar
        className="mt-5"
        label="Progresso médio"
        value={club.stats?.averagePage || 0}
        max={book.totalPages || 1}
        showValue
      />

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-[rgb(var(--bubo-color-text-muted))]">
        <span className="rounded-[var(--bubo-radius-sm)] bg-[rgb(var(--bubo-color-surface-muted))] px-2 py-2">
          <Users className="mx-auto mb-1" size={15} aria-hidden="true" />
          {club.stats?.memberCount || 0}
        </span>
        <span className="rounded-[var(--bubo-radius-sm)] bg-[rgb(var(--bubo-color-surface-muted))] px-2 py-2">
          <MessageSquare className="mx-auto mb-1" size={15} aria-hidden="true" />
          {club.stats?.discussionsCount || 0}
        </span>
        <span className="rounded-[var(--bubo-radius-sm)] bg-[rgb(var(--bubo-color-surface-muted))] px-2 py-2" title={formatTargetDate(club.targetDate)}>
          <CalendarDays className="mx-auto mb-1" size={15} aria-hidden="true" />
          {club.targetDate ? 'Com prazo' : 'Livre'}
        </span>
      </div>

      <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-2">
        <Button as={Link} to={`/clubs/${club._id}`} variant={club.isMember ? 'primary' : 'secondary'} className="w-full" size="sm">
          {club.isMember ? 'Abrir clube' : 'Ver detalhes'}
        </Button>
        {canJoinDirectly && (
          <Button className="w-full" size="sm" onClick={() => onJoin?.(club)} isLoading={isJoining}>
            Entrar
          </Button>
        )}
      </div>
    </Card>
  );
}
