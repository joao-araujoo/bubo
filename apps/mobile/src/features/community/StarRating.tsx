import { Pressable, View } from 'react-native';

import { Icon } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/**
 * Stitch gold stars. Read-only by default; with `onChange` each star is a 48 pt radio button
 * ("Sua avaliação geral").
 */
export function StarRating({
  value,
  size = 16,
  onChange,
  disabled,
}: {
  value: number | null;
  size?: number;
  onChange?: (next: number) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const stars = [1, 2, 3, 4, 5];
  if (!onChange) {
    return (
      <View
        accessible
        accessibilityLabel={value ? `Nota ${value} de 5` : 'Sem nota'}
        style={{ flexDirection: 'row', gap: 2 }}
      >
        {stars.map((star) => (
          <Icon
            key={star}
            name={value !== null && star <= value ? 'star' : 'star-border'}
            size={size}
            color="gold"
          />
        ))}
      </View>
    );
  }
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Sua avaliação geral"
      style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}
    >
      {stars.map((star) => (
        <Pressable
          key={star}
          accessibilityRole="radio"
          accessibilityLabel={star === 1 ? '1 estrela' : `${star} estrelas`}
          accessibilityState={{ checked: value === star, disabled }}
          disabled={disabled}
          hitSlop={4}
          onPress={() => {
            haptics.selection();
            onChange(star);
          }}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon
            name={value !== null && star <= value ? 'star' : 'star-border'}
            size={size}
            color={value !== null && star <= value ? 'gold' : 'goldRim'}
          />
        </Pressable>
      ))}
    </View>
  );
}
