import { type ComponentProps, forwardRef, useState } from 'react';
import { Animated, Pressable, TextInput, type TextInputProps, View } from 'react-native';

import { useMotionValue } from '../lib/motion';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label: string;
  icon?: ComponentProps<typeof Icon>['name'];
  error?: string | null;
  hint?: string;
  /** Password field with a show/hide toggle. */
  secure?: boolean;
  /** The screen draws its own label row; label stays as the accessibility label. */
  hideLabel?: boolean;
};

/** Labelled input: 2px stroke, 14px radius, focus ring, inline error announced to screen readers. */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, icon, error, hint, secure = false, hideLabel = false, onFocus, onBlur, ...input },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const focusOpacity = useMotionValue(focused && !error ? 1 : 0);
  const borderColor = error
    ? theme.colors.error
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {hideLabel ? null : <Text variant="label">{label}</Text>}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.ctaHeight,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.input,
          borderWidth: theme.sizes.borderWidth,
          borderColor,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: theme.radii.input,
            backgroundColor: theme.colors.primarySoft,
            opacity: focusOpacity,
          }}
        />
        {icon ? (
          <Icon
            name={icon}
            size={20}
            color={error ? 'error' : focused ? 'accentText' : 'textMuted'}
          />
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          autoCorrect={secure || input.keyboardType === 'email-address' ? false : undefined}
          submitBehavior={input.returnKeyType === 'next' ? 'submit' : undefined}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          secureTextEntry={secure && !revealed}
          maxFontSizeMultiplier={1.6}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            theme.typography.body,
            {
              flex: 1,
              minWidth: 0,
              minHeight: theme.sizes.ctaHeight - theme.sizes.borderWidth * 2,
              color: theme.colors.text,
              paddingHorizontal: 0,
              paddingVertical: theme.spacing.md,
              textAlignVertical: input.multiline ? 'top' : 'center',
              includeFontPadding: false,
            },
          ]}
          {...input}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityState={{ checked: revealed }}
            onPress={() => {
              haptics.selection();
              setRevealed((value) => !value);
            }}
            style={{
              minWidth: theme.sizes.touchTarget,
              minHeight: theme.sizes.touchTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={revealed ? 'visibility-off' : 'visibility'} size={20} color="textMuted" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          variant="bodySm"
          color="error"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="bodySm" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
