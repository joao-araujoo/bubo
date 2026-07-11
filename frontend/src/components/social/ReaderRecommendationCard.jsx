import React from 'react';
import { BookOpen, Network, UserCheck, UserPlus, UsersRound } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

const signalIcon = (reason) => {
  if (reason.includes('livro')) return BookOpen;
  if (reason.includes('clube')) return UsersRound;
  return Network;
};

export default function ReaderRecommendationCard({ recommendation, onFollow, isUpdating = false }) {
  const { user, reasons = [], score, graphDistance, isFollowing } = recommendation;

  return (
    <article className="flex h-full min-w-[17rem] flex-col rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 shadow-[var(--bubo-shadow-sm)] sm:min-w-0">
      <div className="flex items-start gap-3">
        <Avatar name={user.username} src={user.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-extrabold text-[rgb(var(--bubo-color-text))]">{user.username}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[rgb(var(--bubo-color-text-muted))]">{user.bio || 'Leitor da comunidade Bubo.'}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {reasons.map((reason) => {
          const Icon = signalIcon(reason);
          return (
            <span key={reason} className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--bubo-color-primary)/0.08)] px-2.5 py-1 text-[0.68rem] font-bold text-[rgb(var(--bubo-color-primary))]">
              <Icon size={12} aria-hidden="true" />
              {reason}
            </span>
          );
        })}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div>
          <span className="block text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-[rgb(var(--bubo-color-text-muted))]">Compatibilidade</span>
          <strong className="mt-0.5 block text-lg text-[rgb(var(--bubo-color-text))]">{Math.min(99, score)}%</strong>
          {graphDistance && <span className="block text-[0.68rem] text-[rgb(var(--bubo-color-text-muted))]">distância {graphDistance.toFixed(1)} no grafo</span>}
        </div>
        <Button
          size="sm"
          variant={isFollowing ? 'secondary' : 'primary'}
          isLoading={isUpdating}
          onClick={() => onFollow(user._id)}
          leftIcon={isFollowing ? <UserCheck size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
          aria-pressed={isFollowing}
        >
          {isFollowing ? 'Seguindo' : 'Seguir'}
        </Button>
      </div>
    </article>
  );
}
