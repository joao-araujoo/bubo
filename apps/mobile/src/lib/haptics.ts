import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Semantic haptics. Wraps expo-haptics so features express intent ("success") rather than
 * hardware details, and failures (unsupported device, web) never crash the UI.
 */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';
let enabled = true;

function run(effect: () => Promise<void>) {
  if (!supported || !enabled) return;
  effect().catch(() => undefined);
}

export const haptics = {
  setEnabled(value: boolean) {
    enabled = value;
  },
  /** Light tick for selections (chips, tabs, toggles). */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Tactile button press. */
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Heavier press for primary, committing actions. */
  commit: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
