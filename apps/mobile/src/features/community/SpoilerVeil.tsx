import { pagesUntilUnlocked } from '@bubo/domain';
import { Pressable, View } from 'react-native';

import { Icon, IconTile, Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { pagesLabel } from './meta';

/**
 * Stitch forum veil ("Capítulo 38 (Final da obra) — Você ainda está na pág. 462 · Revelar"): a
 * lavender box with ghost lines where the text would be. The API sent no text at all; "Revelar" is
 * the reader's explicit choice and fetches it again with `reveal=1`.
 */
export function SpoilerVeil({
  spoilerPage,
  chapter,
  readerPage,
  onReveal,
}: {
  spoilerPage: number;
  chapter?: number | null;
  readerPage: number;
  onReveal?: () => void;
}) {
  const theme = useTheme();
  const missing = pagesUntilUnlocked(spoilerPage, readerPage);
  const where = chapter ? `Capítulo ${chapter} · pág. ${spoilerPage}` : `Página ${spoilerPage}`;
  const ghost = (width: `${number}%`) => (
    <View
      style={{
        height: 8,
        width,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.primarySoft,
      }}
    />
  );
  return (
    <View
      accessible
      accessibilityLabel={`Conteúdo protegido: ${where}. Você está na página ${readerPage}; faltam ${pagesLabel(missing)}.`}
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.colors.primarySoft,
      }}
    >
      {ghost('92%')}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <IconTile icon="shield" size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{where}</Text>
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
            {`Você ainda está na pág. ${readerPage} · faltam ${pagesLabel(missing)}`}
          </Text>
        </View>
        {onReveal ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Revelar"
            accessibilityHint="Mostra o conteúdo mesmo antes de você chegar nessa página"
            hitSlop={8}
            onPress={() => {
              haptics.warning();
              onReveal();
            }}
          >
            {({ pressed }) => (
              <Raised
                faceColor={theme.colors.surface}
                borderColor={theme.colors.border}
                rimColor={theme.colors.secondaryRim}
                radius={theme.radii.md}
                depth={3}
                pressed={pressed}
                faceStyle={{
                  minHeight: 36,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                }}
              >
                <Text variant="label" color="accentText" style={{ fontSize: 13 }}>
                  Revelar
                </Text>
              </Raised>
            )}
          </Pressable>
        ) : (
          <Icon name="lock-outline" size={20} color="textMuted" />
        )}
      </View>
      {ghost('70%')}
    </View>
  );
}
