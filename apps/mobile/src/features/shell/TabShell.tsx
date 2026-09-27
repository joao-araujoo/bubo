import { type ReactNode } from 'react';
import { View } from 'react-native';

import { type MascotState } from '../../assets/registry';
import { Card, EmptyState, Screen, Text } from '../../design-system';
import { useTheme } from '../../theme';

type Props = {
  title: string;
  subtitle: string;
  mascot: MascotState;
  emptyTitle: string;
  emptyDescription: string;
  /** Real content; when provided it replaces the empty state. */
  content?: ReactNode;
  /** What this tab will offer — plain product copy, no sample data. */
  upcoming: string[];
  children?: ReactNode;
};

/** Tab layout for areas whose full features arrive in later tasks (honest empty states). */
export function TabShell({
  title,
  subtitle,
  mascot,
  emptyTitle,
  emptyDescription,
  content,
  upcoming,
  children,
}: Props) {
  const theme = useTheme();
  return (
    <Screen
      header={
        <View style={{ gap: theme.spacing.xxs }}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color="textMuted">
            {subtitle}
          </Text>
        </View>
      }
    >
      {content ?? (
        <Card>
          <EmptyState mascot={mascot} title={emptyTitle} description={emptyDescription} />
        </Card>
      )}
      {children}
      <Card tone="muted">
        <Text variant="caption" color="textMuted" accessibilityRole="header">
          O que vai aparecer aqui
        </Text>
        {upcoming.map((item) => (
          <View key={item} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Text variant="body" color="accentText">
              •
            </Text>
            <Text variant="body" style={{ flex: 1 }}>
              {item}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
