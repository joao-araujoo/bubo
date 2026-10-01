import { Pressable, TextInput, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { fontFamily, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Stitch page stepper ("−  462  +"): a raised field with round minus/plus keys around an editable
 * number. The value is kept as text so the reader can type freely; the parent validates it.
 */
export function Stepper({
  label,
  value,
  onChangeText,
  min = 0,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Right-aligned hint, e.g. "de 680". */
  suffix?: string;
}) {
  const theme = useTheme();
  const current = /^\d+$/.test(value.trim()) ? Number(value.trim()) : min;
  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n));
  const change = (delta: number) => {
    const next = clamp(current + delta);
    if (next === current) return;
    haptics.selection();
    onChangeText(String(next));
  };
  const key = (icon: 'remove' | 'add', delta: number, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${step}`}
      onPress={() => change(delta)}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: theme.radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.colors.primary : theme.colors.primarySoft,
      })}
    >
      {({ pressed }) => <Icon name={icon} size={20} color={pressed ? 'onPrimary' : 'accentText'} />}
    </Pressable>
  );
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{label}</Text>
        {suffix ? (
          <Text variant="bodySm" color="textMuted">
            {suffix}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.xs,
          minHeight: 52,
          borderRadius: theme.radii.input,
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        {key('remove', -step, 'Diminuir')}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          selectTextOnFocus
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: fontFamily.extrabold,
            fontSize: 18,
            color: theme.colors.text,
            paddingVertical: 0,
          }}
        />
        {key('add', step, 'Aumentar')}
      </View>
    </View>
  );
}
