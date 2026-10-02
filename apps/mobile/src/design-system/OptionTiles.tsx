import { Pressable, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Raised } from './Raised';
import { Text } from './Text';

export type TileOption<T extends string | number> = {
  value: T;
  label: string;
  /** Second line ("Amplo", "Padrão do Bubo"). */
  caption?: string;
  /** Optional colour swatch drawn above the label (theme palette tiles). */
  swatch?: { fill: string; border: string };
};

/**
 * Stitch tactile option row ("Suave | Equilibrado ✓ | Intensivo", "Foco claro | Sépia | OLED"):
 * equal raised tiles; the selected one is solid Bubo purple with a check. 48 pt+ tall radios.
 */
export function OptionTiles<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  options: TileOption<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', gap: theme.spacing.sm }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={
              option.caption ? `${option.label}, ${option.caption}` : option.label
            }
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(option.value);
            }}
            style={{ flex: 1 }}
          >
            {({ pressed }) => (
              <Raised
                faceColor={selected ? theme.colors.primary : theme.colors.surface}
                borderColor={selected ? theme.colors.primaryRim : theme.colors.borderSoft}
                rimColor={selected ? theme.colors.primaryRim : theme.colors.cardShadow}
                radius={theme.radii.md}
                depth={3}
                pressed={pressed}
                faceStyle={{
                  minHeight: option.swatch ? 76 : 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.xs,
                }}
              >
                {option.swatch ? (
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      marginBottom: 4,
                      borderWidth: 2,
                      borderColor: selected ? theme.colors.onPrimary : option.swatch.border,
                      backgroundColor: option.swatch.fill,
                    }}
                  />
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text
                    variant="label"
                    color={selected ? 'onPrimary' : 'text'}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ flexShrink: 1 }}
                  >
                    {option.label}
                  </Text>
                  {selected ? <Icon name="check" size={14} color="onPrimary" /> : null}
                </View>
                {option.caption ? (
                  <Text
                    variant="bodySm"
                    color={selected ? 'onHeroMuted' : 'textMuted'}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{ fontSize: 11 }}
                  >
                    {option.caption}
                  </Text>
                ) : null}
              </Raised>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
