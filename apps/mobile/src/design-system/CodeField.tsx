import { EMAIL_CODE_LENGTH, normalizeEmailCode } from '@bubo/domain';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

type Props = {
  value: string;
  onChangeText: (digits: string) => void;
  onSubmitEditing?: () => void;
  error?: string | null;
  autoFocus?: boolean;
  disabled?: boolean;
};

/**
 * Six-digit code entry (e-mailed login and password codes, ADR-038): one real text input laid
 * over six tactile cells, so the keyboard, paste and the system's one-time-code autofill all
 * work while the reader sees the digits land one by one.
 */
export function CodeField({
  value,
  onChangeText,
  onSubmitEditing,
  error,
  autoFocus = true,
  disabled = false,
}: Props) {
  const theme = useTheme();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = normalizeEmailCode(value);
  const cells = Array.from({ length: EMAIL_CODE_LENGTH }, (_, index) => digits[index] ?? '');
  const active = Math.min(digits.length, EMAIL_CODE_LENGTH - 1);
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm }}>
        {cells.map((digit, index) => (
          <View
            key={index}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 46,
              height: theme.sizes.ctaHeight,
              borderRadius: theme.radii.input,
              borderWidth: theme.sizes.borderWidth,
              borderColor: error
                ? theme.colors.error
                : focused && index === active
                  ? theme.colors.primary
                  : theme.colors.border,
              backgroundColor:
                focused && index === active ? theme.colors.primarySoft : theme.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="heading">{digit}</Text>
          </View>
        ))}
        <TextInput
          ref={ref}
          value={digits}
          onChangeText={(text) => onChangeText(normalizeEmailCode(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={EMAIL_CODE_LENGTH}
          caretHidden
          returnKeyType="go"
          accessibilityLabel="Código de 6 dígitos"
          accessibilityHint={error ?? 'Digite o código recebido por e-mail'}
          selectionColor={theme.colors.transparent}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            opacity: 0,
            color: theme.colors.transparent,
          }}
        />
      </View>
      {error ? (
        <Text
          variant="bodySm"
          color="error"
          align="center"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
