import { type ReactNode } from 'react';
import { View } from 'react-native';

import { type MascotState } from '../assets/registry';
import { useTheme } from '../theme';
import { BuboMascot } from './BuboMascot';
import { Text } from './Text';

type Props = {
  mascot: MascotState;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

/** Honest empty state: official mascot + plain explanation + optional next step. */
export function EmptyState({ mascot, title, description, action, compact = false }: Props) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        gap: compact ? theme.spacing.md : theme.spacing.sm,
      }}
    >
      <BuboMascot state={mascot} size={compact ? 72 : 144} />
      <View
        style={{
          flex: compact ? 1 : 0,
          gap: theme.spacing.xs,
          alignItems: compact ? 'flex-start' : 'center',
        }}
      >
        <Text variant={compact ? 'titleSm' : 'title'} align={compact ? 'left' : 'center'}>
          {title}
        </Text>
        <Text variant="body" color="textMuted" align={compact ? 'left' : 'center'}>
          {description}
        </Text>
      </View>
      {action ? (
        <View style={{ alignSelf: 'stretch', marginTop: theme.spacing.sm }}>{action}</View>
      ) : null}
    </View>
  );
}
