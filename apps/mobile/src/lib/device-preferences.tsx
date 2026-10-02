import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { haptics } from './haptics';

/**
 * Choices that belong to this device, not the account (ADR-022): theme and haptics. Kept in
 * AsyncStorage; a missing or broken value falls back to the defaults.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type DevicePreferences = {
  theme: ThemeChoice;
  haptics: boolean;
  widgetsEnabled: boolean;
  widgetWeeklyGoal: number;
  hideBookOnLockScreen: boolean;
};

const KEY = 'bubo.device-preferences.v1';
export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  theme: 'light',
  haptics: true,
  widgetsEnabled: true,
  widgetWeeklyGoal: 4,
  hideBookOnLockScreen: true,
};

export async function loadDevicePreferences(): Promise<DevicePreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_DEVICE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<DevicePreferences>;
    return {
      theme: ['system', 'light', 'dark'].includes(String(parsed.theme))
        ? (parsed.theme as ThemeChoice)
        : DEFAULT_DEVICE_PREFERENCES.theme,
      haptics:
        typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULT_DEVICE_PREFERENCES.haptics,
      widgetsEnabled: typeof parsed.widgetsEnabled === 'boolean' ? parsed.widgetsEnabled : true,
      hideBookOnLockScreen: parsed.hideBookOnLockScreen !== false,
      widgetWeeklyGoal:
        typeof parsed.widgetWeeklyGoal === 'number' && Number.isInteger(parsed.widgetWeeklyGoal)
          ? Math.min(7, Math.max(1, parsed.widgetWeeklyGoal))
          : 4,
    };
  } catch {
    return DEFAULT_DEVICE_PREFERENCES;
  }
}

type ContextValue = {
  preferences: DevicePreferences;
  update: (patch: Partial<DevicePreferences>) => void;
};

const DevicePreferencesContext = createContext<ContextValue | null>(null);

export function DevicePreferencesProvider({
  initial,
  children,
}: {
  initial: DevicePreferences;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(initial);
  const update = useCallback((patch: Partial<DevicePreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      haptics.setEnabled(next.haptics);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ preferences, update }), [preferences, update]);
  return (
    <DevicePreferencesContext.Provider value={value}>{children}</DevicePreferencesContext.Provider>
  );
}

export function useDevicePreferences(): ContextValue {
  const context = useContext(DevicePreferencesContext);
  if (!context) throw new Error('useDevicePreferences needs <DevicePreferencesProvider>.');
  return context;
}
