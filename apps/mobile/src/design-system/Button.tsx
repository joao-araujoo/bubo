import { type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { haptics } from '../lib/haptics';
import { type ColorTokens, useTheme } from '../theme';
import { Icon } from './Icon';
import { Raised } from './Raised';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'success';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: ComponentProps<typeof Icon>['name'];
  /** Trailing element, e.g. an XP badge. */
  trailing?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Reduced label, icon and padding for buttons in dense horizontal groups. */
  compact?: boolean;
  /**
   * Shows only the icon (requires `icon`). `label` stays the accessibility label, so screen
   * readers still announce the action.
   */
  iconOnly?: boolean;
  /** Full action name for screen readers when the visible `label` is shortened. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const variantColors = (colors: ColorTokens, variant: ButtonVariant) => {
  switch (variant) {
    case 'primary':
      return {
        face: colors.primary,
        border: colors.primary,
        rim: colors.primaryRim,
        text: 'onPrimary' as const,
      };
    case 'success':
      return {
        face: colors.success,
        border: colors.success,
        rim: colors.successRim,
        text: 'onSuccess' as const,
      };
    case 'secondary':
      return {
        face: colors.surface,
        border: colors.border,
        rim: colors.secondaryRim,
        text: 'text' as const,
      };
  }
};

/**
 * Tactile "pushdown" button (Stitch design system): a solid rim below the face that the face
 * sinks onto when pressed, with a haptic tick. Height ≥ 48 (md) / 56 (lg).
 * Compact mode keeps dense button groups on one line while preserving the touch target.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  trailing,
  disabled = false,
  loading = false,
  fullWidth = false,
  compact = false,
  iconOnly = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const theme = useTheme();
  const palette = variantColors(theme.colors, variant);
  const inactive = disabled || loading;
  const height = size === 'lg' ? theme.sizes.ctaHeight : theme.sizes.touchTarget;
  const bare = iconOnly && icon !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => (variant === 'primary' ? haptics.commit() : haptics.press())}
      onPress={onPress}
      style={[{ opacity: inactive ? 0.5 : 1, alignSelf: fullWidth ? 'stretch' : 'auto' }, style]}
    >
      {({ pressed }) => (
        <Raised
          faceColor={palette.face}
          borderColor={palette.border}
          rimColor={palette.rim}
          radius={theme.radii.pill}
          depth={theme.sizes.rim}
          pressed={pressed && !inactive}
          faceStyle={[
            styles.face,
            {
              minHeight: height,
              minWidth: bare ? height : undefined,
              paddingHorizontal: bare
                ? theme.spacing.sm
                : compact
                  ? theme.spacing.xs
                  : theme.spacing.lg,
              paddingVertical: compact ? theme.spacing.xs : theme.spacing.md,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors[palette.text]} />
          ) : (
            <View style={[styles.content, { gap: compact ? theme.spacing.xs : theme.spacing.sm }]}>
              {icon ? (
                <Icon name={icon} size={bare ? 22 : compact ? 18 : 20} color={palette.text} />
              ) : null}
              {bare ? null : (
                <Text
                  variant={compact ? 'label' : 'labelLg'}
                  color={palette.text}
                  align="center"
                  numberOfLines={compact ? 1 : undefined}
                  // Dense rows shrink the label slightly instead of truncating it.
                  adjustsFontSizeToFit={compact}
                  minimumFontScale={0.8}
                  style={{ flexShrink: 1 }}
                >
                  {label}
                </Text>
              )}
              {trailing}
            </View>
          )}
        </Raised>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
