import { type ClubDetail } from '@bubo/contracts';
import { View } from 'react-native';

import { BookCover, Icon, Text } from '../../design-system';
import { useTheme } from '../../theme';
import { membersLabel, topicsLabel } from './meta';

/**
 * Stitch club strip under the header: tiny cover, "Autor • N págs.", members and debates, and the
 * green "ANTI-SPOILER Pág. X sua" box with the reader's own page.
 */
export function BookStrip({ club }: { club: ClubDetail }) {
  const theme = useTheme();
  const byline = [club.book.author, club.book.totalPages ? `${club.book.totalPages} págs.` : null]
    .filter(Boolean)
    .join(' • ');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.borderSoft,
        backgroundColor: theme.colors.surface,
      }}
    >
      <BookCover
        title={club.book.title}
        author={club.book.author}
        coverUrls={club.book.coverUrls}
        width={36}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {byline || club.book.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Icon name="group" size={15} color="accentText" />
          <Text
            variant="bodySm"
            color="accentText"
            numberOfLines={2}
            style={{ flex: 1, fontSize: 12 }}
          >
            {`${membersLabel(club.memberCount)} • ${topicsLabel(club.topicCount)}`}
          </Text>
        </View>
      </View>
      {club.readerPage !== null ? (
        <View
          accessible
          accessibilityLabel={`Anti-spoiler: você está na página ${club.readerPage}`}
          style={{
            alignItems: 'center',
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.success,
            backgroundColor: theme.colors.successSoft,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name="shield" size={12} color="successText" />
            <Text variant="caption" color="successText" style={{ fontSize: 9 }}>
              Anti-spoiler
            </Text>
          </View>
          <Text variant="label" style={{ fontSize: 12 }}>
            {`Pág. ${club.readerPage} sua`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
