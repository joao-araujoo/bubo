import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'success' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
};

const palette = {
  primary: {
    background: colors.primary,
    border: colors.primaryPressed,
    text: '#FFFFFF',
  },
  secondary: {
    background: colors.surface,
    border: colors.borderStrong,
    text: colors.primaryPressed,
  },
  success: {
    background: colors.success,
    border: '#1E9E55',
    text: '#0D3C22',
  },
  danger: {
    background: colors.error,
    border: '#C43E3E',
    text: '#FFFFFF',
  },
} as const;

export function BuboButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  leading,
  trailing,
  fullWidth = true,
  accessibilityLabel,
}: Props) {
  const tone = palette[variant];
  const blocked = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPressIn={() => {
        if (!blocked) void Haptics.selectionAsync();
      }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          backgroundColor: tone.background,
          borderColor: tone.border,
          borderBottomWidth: pressed ? 2 : 5,
          transform: [{ translateY: pressed ? 3 : 0 }],
          opacity: blocked ? 0.52 : 1,
        },
      ]}
    >
      <View style={styles.slot}>{leading}</View>
      {loading ? (
        <ActivityIndicator color={tone.text} />
      ) : (
        <Text numberOfLines={1} style={[styles.label, { color: tone.text }]}>
          {label}
        </Text>
      )}
      <View style={[styles.slot, styles.trailing]}>{trailing}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderWidth: 2,
    borderRadius: radii.control,
    paddingHorizontal: 16,
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  slot: {
    width: 26,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: {
    marginLeft: 8,
  },
});
