import { buildWidgetSnapshot, toLocalIsoDate } from '@bubo/domain';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useDueCards, useLeague, useShelf, useStats } from '../../lib/api/queries';
import { type AuthState } from '../../lib/auth/session';
import { useDevicePreferences } from '../../lib/device-preferences';
import { clearWidgets, widgetPublisher, widgetsAvailable } from './native';

/** Observer lives above tabs, so mutations refresh installed widgets on every screen. */
export function useWidgetSync(auth: AuthState) {
  const { preferences } = useDevicePreferences();
  const userId =
    auth.status === 'ready' && preferences.widgetsEnabled && widgetsAvailable
      ? auth.userId
      : undefined;
  const [clock, setClock] = useState(() => Date.now());
  const shelf = useShelf(userId);
  const stats = useStats(userId);
  const due = useDueCards(userId);
  // Optional: an unavailable league never holds up the streak, calendar or book widgets.
  const league = useLeague(userId);
  const today = toLocalIsoDate(new Date(clock));

  useEffect(() => {
    const tick = () => setClock(Date.now());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    const timer = setInterval(tick, 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    // Clear before publishing for a different account, on revocation, or when disabled.
    void clearWidgets().catch(() => undefined);
    if (userId) widgetPublisher?.activate();
  }, [userId]);

  useEffect(() => {
    if (!userId || !shelf.data || !stats.data || !due.data || !widgetPublisher) return;
    const updatedAt = Math.min(shelf.dataUpdatedAt, stats.dataUpdatedAt, due.dataUpdatedAt);
    const snapshot = buildWidgetSnapshot({
      now: new Date(),
      updatedAt,
      hideBookOnLockScreen: preferences.hideBookOnLockScreen,
      weeklyGoal: preferences.widgetWeeklyGoal,
      entries: shelf.data.entries,
      stats: stats.data,
      due: due.data,
      league: league.data ?? null,
    });
    void widgetPublisher.publish(snapshot).catch(() => undefined);
  }, [
    userId,
    shelf.data,
    shelf.dataUpdatedAt,
    stats.data,
    stats.dataUpdatedAt,
    due.data,
    due.dataUpdatedAt,
    league.data,
    today,
    preferences.hideBookOnLockScreen,
    preferences.widgetWeeklyGoal,
  ]);
}
