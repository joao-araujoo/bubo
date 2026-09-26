import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import { colors, fonts, radii } from '../../theme/tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  error?: string;
};

export function BuboInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  error,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.frame,
          focused && styles.focused,
          Boolean(error) && styles.errorFrame,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9B92AD"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          selectionColor={colors.primary}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 7,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  frame: {
    minHeight: 54,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.control,
  },
  focused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.13,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
  },
  errorFrame: {
    borderColor: colors.error,
  },
  input: {
    minHeight: 52,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    color: colors.error,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
});
