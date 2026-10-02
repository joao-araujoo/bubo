import { useRouter } from 'expo-router';

import { HeaderButton } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useNotifications } from '../../lib/api/queries';

/** Header bell with the real unread count (never a decorative dot). */
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const inbox = useNotifications(userId);
  const unread = inbox.data?.unreadCount ?? 0;
  return (
    <HeaderButton
      icon={unread > 0 ? 'notifications-active' : 'notifications-none'}
      iconColor="accentText"
      label="Notificações"
      badge={unread}
      onPress={() => {
        haptics.selection();
        router.push('/notificacoes');
      }}
    />
  );
}
