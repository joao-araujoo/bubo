import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

/**
 * The section heading outside cards, the same on every screen (ADR-047): a sentence-case title,
 * an optional line of context and, on the right, either a text link ("Ver tudo") or any trailing
 * element (a count, a pill, a toggle).
 */
export function SectionTitle({
  title,
  subtitle,
  trailing,
  link,
  onLink,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** Text link on the right; needs `onLink`. Wins over `trailing`. */
  link?: string;
  onLink?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {link && onLink ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${link}: ${title}`}
          hitSlop={8}
          onPress={onLink}
          style={{ minHeight: theme.sizes.touchTarget, justifyContent: 'center' }}
        >
          <Text variant="label" color="accentText">
            {link}
          </Text>
        </Pressable>
      ) : (
        trailing
      )}
    </View>
  );
}
