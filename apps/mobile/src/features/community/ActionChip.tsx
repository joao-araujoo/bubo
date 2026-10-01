import { Pressable } from 'react-native';

import { Icon, Raised, Text } from '../../design-system';
import { useTheme } from '../../theme';

/** Small raised text action under community content (Denunciar, Bloquear, Apagar…). */
export function ActionChip({
  label,
  icon,
  tone = 'default',
  onPress,
}: {
  label: string;
  icon: 'flag' | 'block' | 'delete-outline' | 'remove-circle-outline' | 'restore' | 'edit';
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress}>
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.border}
          rimColor={theme.colors.secondaryRim}
          radius={theme.radii.md}
          depth={3}
          pressed={pressed}
          faceStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            minHeight: 36,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <Icon name={icon} size={16} color={tone === 'danger' ? 'errorText' : 'textMuted'} />
          <Text
            variant="label"
            color={tone === 'danger' ? 'errorText' : 'textMuted'}
            style={{ fontSize: 12 }}
          >
            {label}
          </Text>
        </Raised>
      )}
    </Pressable>
  );
}
