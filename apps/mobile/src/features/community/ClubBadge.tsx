import { type ClubIcon } from '@bubo/contracts';
import { View } from 'react-native';

import { Icon } from '../../design-system';
import { useTheme } from '../../theme';
import { CLUB_ICON_META } from './meta';

/** Square tactile badge with the club's icon (Stitch "Badge tátil"). Decorative. */
export function ClubBadge({ icon, size = 48 }: { icon: ClubIcon; size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.primarySoft,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.borderSoft,
      }}
    >
      <Icon name={CLUB_ICON_META[icon].icon} size={Math.round(size * 0.55)} color="accentText" />
    </View>
  );
}
