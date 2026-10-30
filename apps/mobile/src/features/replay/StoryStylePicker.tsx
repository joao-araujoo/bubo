import { Pressable, View } from 'react-native';

import { Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { storyThemes, useTheme, type StoryStyle } from '../../theme';

export function StoryStylePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: StoryStyle;
  onChange: (value: StoryStyle) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const options = [
    { id: 'paper', label: 'Papel' },
    { id: 'night', label: 'Noite' },
    { id: 'violet', label: 'Violeta' },
  ] as const;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Estilo da arte"
      style={{ flexDirection: 'row', gap: theme.spacing.sm }}
    >
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: value === option.id, disabled }}
          disabled={disabled}
          onPress={() => {
            haptics.selection();
            onChange(option.id);
          }}
          style={{
            flex: 1,
            minHeight: 48,
            padding: theme.spacing.sm,
            borderRadius: theme.radii.md,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 7,
            borderWidth: 2,
            borderColor: value === option.id ? theme.colors.primary : theme.colors.borderSoft,
            backgroundColor: theme.colors.surface,
          }}
        >
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: storyThemes[option.id].background,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          />
          <Text variant="label">{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
