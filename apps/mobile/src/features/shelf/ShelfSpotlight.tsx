import { type ShelfEntry } from '@bubo/contracts';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Book3D, Button, Chip, LinkButton, Text } from '../../design-system';
import { StarRating } from '../community/StarRating';
import { useReducedMotion } from '../../lib/motion';
import { RATING_LABELS } from '../../lib/rating-prompt';
import { useTheme } from '../../theme';
import { STATUS_META } from './labels';

type Props = {
  entry: ShelfEntry | null;
  onClose: () => void;
  onOpen: (entry: ShelfEntry) => void;
};

/**
 * The book pulled off the 3D bookcase: a dimmed room, the book in 3D rising to the reader,
 * its real title, author, status and private rating, and two exits (open the book, put it
 * back). Pure visualisation: nothing here changes data.
 */
export function ShelfSpotlight({ entry, onClose, onOpen }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!entry) return;
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.spring(progress, {
      toValue: 1,
      damping: 16,
      stiffness: 150,
      mass: 0.9,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entry, progress, reduced]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const status = entry ? STATUS_META[entry.status] : null;

  return (
    <Modal
      visible={entry !== null}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Devolver o livro à estante"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.colors.scrim }}
      />
      {entry && status ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: insets.top,
            bottom: insets.bottom,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.sizes.gutter,
          }}
        >
          <Animated.View
            style={{
              width: '100%',
              maxWidth: 420,
              alignItems: 'center',
              gap: theme.spacing.sm,
              padding: theme.spacing.lg,
              borderRadius: theme.radii.card,
              backgroundColor: theme.colors.surface,
              opacity: progress,
              transform: [{ translateY }, { scale }],
            }}
          >
            <Book3D
              title={entry.book.title}
              author={entry.book.author}
              coverUrls={entry.book.coverUrls}
              totalPages={entry.book.totalPages}
              width={160}
              priority="high"
            />
            <Text variant="heading" accessibilityRole="header" align="center" numberOfLines={3}>
              {entry.book.title}
            </Text>
            {entry.book.author ? (
              <Text variant="body" color="textMuted" align="center" numberOfLines={2}>
                {entry.book.author}
              </Text>
            ) : null}
            <Chip label={status.label} tone={status.tone} icon={status.icon} />
            {entry.rating !== null ? (
              <View style={{ alignItems: 'center', gap: theme.spacing.xxs }}>
                <StarRating value={entry.rating} size={22} disabled />
                <Text variant="label" color="accentText">
                  {RATING_LABELS[entry.rating]}
                </Text>
              </View>
            ) : null}
            {entry.book.totalPages ? (
              <Text variant="bodySm" color="textMuted">
                {entry.book.totalPages} páginas
              </Text>
            ) : null}
            <View
              style={{ alignSelf: 'stretch', gap: theme.spacing.xs, marginTop: theme.spacing.xs }}
            >
              <Button
                label="Abrir livro"
                icon="menu-book"
                fullWidth
                onPress={() => onOpen(entry)}
              />
              <LinkButton label="Devolver à estante" onPress={onClose} />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}
