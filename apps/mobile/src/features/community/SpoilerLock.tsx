import { pagesUntilUnlocked } from '@bubo/domain';
import { View } from 'react-native';

import { Icon, LinkButton, Text } from '../../design-system';
import { useTheme } from '../../theme';
import { pagesLabel } from './meta';

/**
 * Stitch "Contém spoiler da página N": the API sent no text at all, only the page. Peeking is an
 * explicit choice that fetches the content again with `reveal=1`.
 */
export function SpoilerLock({
  spoilerPage,
  readerPage,
  onPeek,
}: {
  spoilerPage: number;
  readerPage: number;
  onPeek?: () => void;
}) {
  const theme = useTheme();
  const missing = pagesUntilUnlocked(spoilerPage, readerPage);
  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.xs,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        borderWidth: theme.sizes.borderWidth,
        borderStyle: 'dashed',
        borderColor: theme.colors.gold,
        backgroundColor: theme.colors.goldSoft,
      }}
    >
      <Icon name="visibility-off" size={24} color="goldRim" />
      <Text variant="bodyStrong" align="center">
        Contém spoiler da página {spoilerPage}
      </Text>
      <Text variant="bodySm" color="textMuted" align="center">
        {`Você está na pág. ${readerPage}. Faltam ${pagesLabel(missing)} para desbloquear.`}
      </Text>
      {onPeek ? (
        <LinkButton
          label="Quero espiar mesmo assim"
          align="center"
          accessibilityHint="Mostra o conteúdo mesmo antes de você chegar nessa página"
          onPress={onPeek}
        />
      ) : null}
    </View>
  );
}
