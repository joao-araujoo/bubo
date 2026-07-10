import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocialStore } from '../../stores/useSocialStore';
import { formatRelativeTime } from '../../utils/formatters';
import Avatar from '../ui/Avatar';
import Skeleton from '../ui/Skeleton';

const typeMeta = {
  like: {
    Icon: Heart,
    text: 'curtiu sua publicação'
  },
  comment: {
    Icon: MessageCircle,
    text: 'comentou na sua publicação'
  },
  follow: {
    Icon: UserPlus,
    text: 'começou a seguir você'
  }
};

export default function NotificationBell() {
  const {
    fetchNotifications,
    isLoadingNotifications,
    markNotificationsRead,
    notifications,
    unreadNotifications
  } = useSocialStore();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    fetchNotifications().catch(() => {});
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.isRead).map((notification) => notification._id),
    [notifications]
  );

  const open = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && unreadIds.length > 0) {
      try {
        await markNotificationsRead(unreadIds);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Não foi possível atualizar as notificações.');
      }
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))]"
        aria-label={unreadNotifications > 0 ? `${unreadNotifications} notificações não lidas` : 'Notificações'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadNotifications > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[rgb(var(--bubo-color-danger))] px-1 text-[0.65rem] font-black text-white">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-lg)]"
          role="dialog"
          aria-label="Central de notificações"
        >
          <header className="flex items-center justify-between border-b border-[rgb(var(--bubo-color-border))] px-4 py-3">
            <div>
              <strong className="block">Notificações</strong>
              <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">Interações recentes da comunidade</span>
            </div>
            <CheckCheck size={18} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
          </header>

          <div className="max-h-[28rem] overflow-y-auto p-2">
            {isLoadingNotifications ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex gap-3 p-3">
                  <Skeleton className="h-10 w-10" rounded="full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[rgb(var(--bubo-color-text-muted))]">
                Nenhuma notificação ainda. Continue lendo e participando da comunidade.
              </p>
            ) : (
              notifications.map((notification) => {
                const meta = typeMeta[notification.type] || typeMeta.comment;
                const Icon = meta.Icon;
                return (
                  <article
                    key={notification._id}
                    className={`flex gap-3 rounded-[var(--bubo-radius-md)] p-3 ${notification.isRead ? '' : 'bg-[rgb(var(--bubo-color-primary)/0.07)]'}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={notification.actor.username} src={notification.actor.avatar} size="sm" />
                      <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-primary))] shadow-[var(--bubo-shadow-sm)]">
                        <Icon size={12} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-5">
                        <strong>{notification.actor.username}</strong> {meta.text}.
                      </p>
                      {notification.activityMessage && (
                        <p className="mt-1 line-clamp-1 text-xs text-[rgb(var(--bubo-color-text-muted))]">
                          “{notification.activityMessage}”
                        </p>
                      )}
                      <span className="mt-1 block text-xs text-[rgb(var(--bubo-color-text-muted))]">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
