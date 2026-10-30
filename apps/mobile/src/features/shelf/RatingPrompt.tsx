import { type ShelfEntry } from '@bubo/contracts';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';

import {
  BookCover,
  BuboMascot,
  Button,
  InlineMessage,
  LinkButton,
  Text,
} from '../../design-system';
import { StarRating } from '../community/StarRating';
import { useUpdateShelfEntry } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useReducedMotion } from '../../lib/motion';
import { RATING_LABELS, ratingPrompt } from '../../lib/rating-prompt';
import { motion, useTheme } from '../../theme';

function RatingCard({
  entry,
  userId,
  onClose,
}: {
  entry: ShelfEntry;
  userId: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const update = useUpdateShelfEntry(userId, entry.id);
  const [rating, setRating] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptics.success();
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: reduced ? 0 : motion.slow,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduced]);

  async function save() {
    if (rating === null || update.isPending) return;
    setFailed(false);
    try {
      await update.mutateAsync({ rating });
      haptics.success();
      onClose();
    } catch {
      haptics.error();
      setFailed(true);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: theme.sizes.gutter }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Agora não"
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.scrim,
        }}
      />
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={`Dar nota para ${entry.book.title}`}
        style={{
          alignSelf: 'center',
          width: '100%',
          maxWidth: 380,
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.card + 4,
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.borderSoft,
          backgroundColor: theme.colors.surface,
          opacity: enter,
          transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }}
      >
        <View style={{ marginBottom: theme.spacing.xs }}>
          <BookCover
            title={entry.book.title}
            author={entry.book.author}
            coverUrls={entry.book.coverUrls}
            width={112}
            priority="high"
          />
          <View style={{ position: 'absolute', right: -44, bottom: -14 }}>
            <BuboMascot state="sessionComplete" size={68} decorative />
          </View>
        </View>
        <Text variant="caption" color="accentText" align="center">
          Leitura concluída
        </Text>
        <Text variant="title" align="center" numberOfLines={2}>
          {entry.book.title}
        </Text>
        <Text variant="body" color="textMuted" align="center">
          Que nota você dá para este livro?
        </Text>
        <StarRating
          value={rating}
          size={38}
          disabled={update.isPending}
          onChange={(next) => setRating(next)}
        />
        <Text
          variant="label"
          color={rating === null ? 'textMuted' : 'accentText'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {rating === null ? 'Toque nas estrelas' : RATING_LABELS[rating]}
        </Text>
        {failed ? (
          <InlineMessage tone="error" message="Não foi possível salvar a nota. Tente de novo." />
        ) : null}
        <View style={{ alignSelf: 'stretch', marginTop: theme.spacing.sm }}>
          <Button
            label="Salvar nota"
            icon="star"
            fullWidth
            disabled={rating === null}
            loading={update.isPending}
            onPress={() => void save()}
          />
        </View>
        <LinkButton label="Agora não" onPress={onClose} />
      </Animated.View>
    </View>
  );
}

/** Root host: shows the rating popup whenever a book becomes "Lido" without a rating. */
export function RatingPromptHost() {
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const [entry, setEntry] = useState<ShelfEntry | null>(null);
  useEffect(() => ratingPrompt.subscribe(setEntry), []);
  const close = () => setEntry(null);
  return (
    <Modal
      visible={entry !== null && userId !== undefined}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      {entry && userId ? (
        <RatingCard key={entry.id} entry={entry} userId={userId} onClose={close} />
      ) : null}
    </Modal>
  );
}
