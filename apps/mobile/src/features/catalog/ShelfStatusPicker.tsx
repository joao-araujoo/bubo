import { type ComponentProps } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon, Text } from '../../design-system';
import { Raised } from '../../design-system/Raised';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

export type AddShelfStatus = 'want_to_read' | 'reading' | 'finished';
export const ADD_SHELF_OPTIONS: readonly {
  status: AddShelfStatus;
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
}[] = [
  { status: 'want_to_read', label: 'Quero ler', icon: 'bookmark-border' },
  { status: 'reading', label: 'Lendo', icon: 'auto-stories' },
  { status: 'finished', label: 'Já li', icon: 'check-circle-outline' },
];

/** Choose the destination once, then add several books to the same shelf. */
export function ShelfStatusPicker({
  status,
  onChange,
  disabled = false,
}: {
  status: AddShelfStatus;
  onChange: (status: AddShelfStatus) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label">Adicionar em</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.sm }}
      >
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', gap: theme.spacing.sm }}
        >
          {ADD_SHELF_OPTIONS.map((option) => {
            const selected = status === option.status;
            return (
              <Pressable
                key={option.status}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => {
                  haptics.selection();
                  onChange(option.status);
                }}
              >
                <Raised
                  faceColor={selected ? theme.colors.primarySoft : theme.colors.surface}
                  borderColor={selected ? theme.colors.primary : theme.colors.borderSoft}
                  rimColor={selected ? theme.colors.primaryRim : theme.colors.cardShadow}
                  radius={theme.radii.lg}
                  depth={theme.sizes.cardRim}
                  faceStyle={{
                    minHeight: theme.sizes.touchTarget,
                    paddingHorizontal: theme.spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                  }}
                >
                  <Icon
                    name={option.icon}
                    color={selected ? 'accentText' : 'textMuted'}
                    size={18}
                  />
                  <Text variant="label" color={selected ? 'accentText' : 'text'}>
                    {option.label}
                  </Text>
                </Raised>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {status === 'finished' ? (
        <Text variant="caption" color="textMuted">
          Registra que você já leu. A atividade no Bubo vem das suas sessões.
        </Text>
      ) : null}
    </View>
  );
}
