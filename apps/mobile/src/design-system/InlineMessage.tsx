import { View } from 'react-native';

import { FadeIn } from '../lib/motion';
import { type ColorTokens, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Tone = 'error' | 'success' | 'info';

const tones: Record<
  Tone,
  {
    bg: keyof ColorTokens;
    icon: 'error-outline' | 'check-circle' | 'info-outline';
    iconColor: keyof ColorTokens;
  }
> = {
  error: { bg: 'errorSoft', icon: 'error-outline', iconColor: 'error' },
  success: { bg: 'primarySoft', icon: 'check-circle', iconColor: 'success' },
  info: { bg: 'surfaceMuted', icon: 'info-outline', iconColor: 'accentText' },
};

/** Inline, screen-reader-announced feedback for forms. */
export function InlineMessage({ tone, message }: { tone: Tone; message: string }) {
  const theme = useTheme();
  const style = tones[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors[style.bg],
      }}
    >
      <FadeIn key={tone}>
        <Icon name={style.icon} size={20} color={style.iconColor} />
      </FadeIn>
      <Text variant="bodySm" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
