import { type ComponentProps } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { useMotionValue } from '../lib/motion';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Raised } from './Raised';
import { Text } from './Text';

type Props = {
  title: string;
  description?: string;
  icon: ComponentProps<typeof Icon>['name'];
  selected: boolean;
  onPress: () => void;
  /** `radio` for single choice, `checkbox` for multi-select. */
  mode: 'radio' | 'checkbox';
  /** Two-column goal tile from the onboarding model. */
  compact?: boolean;
};

/** Tactile option tile (onboarding answers). Selected = purple stroke + purple rim + check. */
export function SelectableCard({
  title,
  description,
  icon,
  selected,
  onPress,
  mode,
  compact = false,
}: Props) {
  const theme = useTheme();
  const scale = useMotionValue(selected ? 1.08 : 1);
  return (
    <Pressable
      style={compact ? { width: '48%' } : undefined}
      accessibilityRole={mode}
      accessibilityState={mode === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={selected ? theme.colors.primarySoft : theme.colors.surface}
          borderColor={selected ? theme.colors.primary : theme.colors.borderSoft}
          rimColor={selected ? theme.colors.primaryRim : theme.colors.cardShadow}
          radius={theme.radii.lg}
          depth={theme.sizes.cardRim}
          pressed={pressed}
          faceStyle={{
            flexDirection: compact ? 'column' : 'row',
            alignItems: compact ? 'stretch' : 'center',
            gap: theme.spacing.md,
            minHeight: compact ? 122 : theme.sizes.ctaHeight + theme.spacing.lg,
            padding: theme.spacing.md,
          }}
        >
          <View
            style={
              compact
                ? { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
                : undefined
            }
          >
            <View
              style={{
                width: compact ? 28 : 44,
                height: compact ? 28 : 44,
                borderRadius: theme.radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  selected && !compact ? theme.colors.primary : theme.colors.surfaceMuted,
              }}
            >
              <Animated.View style={{ transform: [{ scale }] }}>
                <Icon
                  name={icon}
                  size={compact ? 22 : 24}
                  color={selected && !compact ? 'onPrimary' : 'accentText'}
                />
              </Animated.View>
            </View>
            {compact ? (
              <Icon
                name={selected ? 'check-circle' : 'radio-button-unchecked'}
                size={22}
                color={selected ? 'accentText' : 'textMuted'}
              />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{title}</Text>
            {description ? (
              <Text variant="bodySm" color="textMuted">
                {description}
              </Text>
            ) : null}
          </View>
          {!compact ? (
            <Icon
              name={
                mode === 'radio'
                  ? selected
                    ? 'radio-button-checked'
                    : 'radio-button-unchecked'
                  : selected
                    ? 'check-box'
                    : 'check-box-outline-blank'
              }
              size={24}
              color={selected ? 'accentText' : 'textMuted'}
            />
          ) : null}
        </Raised>
      )}
    </Pressable>
  );
}
