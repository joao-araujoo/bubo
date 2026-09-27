import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, TextInput } from 'react-native';

import { Icon, Text } from '../../design-system';
import { Raised } from '../../design-system/Raised';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  /** Shows the "ISBN" button (opens the barcode scanner). */
  onScanPress?: () => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

/** Stitch "Descobrir" search bar: raised pill, magnifier, clear button and the ISBN shortcut. */
export const SearchField = forwardRef<TextInput, Props>(function SearchField(
  {
    value,
    onChangeText,
    onSubmit,
    onScanPress,
    loading = false,
    placeholder = 'Buscar título, autor ou ISBN…',
    autoFocus = false,
  },
  ref,
) {
  const theme = useTheme();
  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={theme.colors.borderSoft}
      rimColor={theme.colors.cardShadow}
      radius={theme.radii.card}
      depth={theme.sizes.cardRim}
      faceStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: 60,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.sm,
      }}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Buscando" />
      ) : (
        <Icon name="search" size={24} color="primary" />
      )}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.primary}
        accessibilityLabel="Buscar livros"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        maxFontSizeMultiplier={1.6}
        style={[
          theme.typography.body,
          { flex: 1, color: theme.colors.text, paddingVertical: theme.spacing.sm },
        ]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          hitSlop={8}
          onPress={() => onChangeText('')}
          style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={20} color="textMuted" />
        </Pressable>
      ) : null}
      {onScanPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ler código de barras (ISBN)"
          onPress={() => {
            haptics.press();
            onScanPress();
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            minHeight: theme.sizes.touchTarget - 4,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.pill,
            borderWidth: theme.sizes.borderWidth,
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
          })}
        >
          <Icon name="qr-code-scanner" size={18} color="accentText" />
          <Text variant="label" color="accentText">
            ISBN
          </Text>
        </Pressable>
      ) : null}
    </Raised>
  );
});
