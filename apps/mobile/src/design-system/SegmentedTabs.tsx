import { Pressable, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';
import { Text } from './Text';

export type SegmentOption<T extends string> = { id: T; label: string; count?: number };

/**
 * Stitch segmented control ("Feed Geral | Seus Clubes | Descobrir", "7 Dias | 30 Dias"): a lavender
 * track with the selected segment filled in Bubo purple.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: theme.spacing.xxs,
        padding: theme.spacing.xs,
        borderRadius: theme.radii.lg,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.borderSoft,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              option.count !== undefined ? `${option.label}, ${option.count}` : option.label
            }
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(option.id);
            }}
            style={{
              flex: 1,
              minHeight: theme.sizes.touchTarget,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xs,
              paddingHorizontal: theme.spacing.xs,
              borderRadius: theme.radii.md,
              backgroundColor: selected ? theme.colors.primary : theme.colors.transparent,
            }}
          >
            <Text
              variant="label"
              color={selected ? 'onPrimary' : 'textMuted'}
              align="center"
              numberOfLines={2}
              style={{ fontSize: 13, lineHeight: 16, flexShrink: 1 }}
            >
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <View
                style={{
                  minWidth: 20,
                  paddingHorizontal: 6,
                  borderRadius: theme.radii.pill,
                  backgroundColor: selected ? theme.colors.primaryRim : theme.colors.primarySoft,
                }}
              >
                <Text
                  variant="caption"
                  color={selected ? 'onPrimary' : 'accentText'}
                  align="center"
                  style={{ lineHeight: 18 }}
                >
                  {option.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
