import { type ShelfEntry } from '@bubo/contracts';
import {
  packShelfRows,
  spineHeightRatio,
  spineWidth,
  stableBucket,
  type ShelfItem,
} from '@bubo/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { BookCover, BuboMascot, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useMotionValue } from '../../lib/motion';
import { coverPalettes, shelfPalette, useTheme } from '../../theme';
import { STATUS_ORDER } from './labels';

type Props = {
  entries: readonly ShelfEntry[];
  /** Outer width of the bookcase in points. */
  width: number;
  selectedId: string | null;
  onSelect: (entry: ShelfEntry) => void;
};

/** Side panels of the bookcase. */
const SIDE = 12;
/** Inner padding between the side panels and the first/last book. */
const INSET = 8;
/** Free height of a shelf (board to board). */
const CAVITY = 156;
const BOARD_TOP = 6;
const BOARD_FRONT = 14;
const BOARD_SHADOW = 12;
const GAP = 3;
/** Books being read stand face out, so their real cover shows. */
const FACE_OUT_COVER = 54;
const FACE_OUT_WIDTH = FACE_OUT_COVER + 6;
/** Room above the bookcase for the lamp glow and Bubo sitting on the top board. */
const TOP_ROOM = 76;

/**
 * A cozy wooden bookcase drawn from real shelf entries (ADR-037): boards with a lit top face,
 * a front face and a cast shadow; books standing as spines whose width follows the real page
 * count and whose colour/height are stable per title; books being read stand face out with their
 * real cover. The selected book lifts a little out of its row (the spotlight shows it in 3D).
 * Pure layout comes from `packShelfRows`; nothing here is stored or fake.
 */
export function Bookcase3D({ entries, width, selectedId, onSelect }: Props) {
  const theme = useTheme();
  const innerWidth = width - SIDE * 2 - INSET * 2;
  const ordered = [...entries].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  const items: ShelfItem<ShelfEntry>[] = ordered.map((entry) => ({
    item: entry,
    width: entry.status === 'reading' ? FACE_OUT_WIDTH : spineWidth(entry.book.totalPages),
  }));
  const rows = packShelfRows(items, innerWidth, GAP);
  const dark = theme.scheme === 'dark';

  return (
    <View style={{ width }}>
      <View style={{ height: TOP_ROOM, justifyContent: 'flex-end' }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -width * 0.15,
            top: -TOP_ROOM * 0.9,
            width: width * 0.8,
            height: TOP_ROOM * 2.2,
            borderRadius: theme.radii.pill,
            backgroundColor: dark ? shelfPalette.lampDark : shelfPalette.lampLight,
            opacity: 0.55,
          }}
        />
        <View style={{ alignItems: 'flex-end', paddingRight: SIDE + INSET }}>
          {/* Bubo sits on the top board: the "main" pose (profile state) is the closest official one. */}
          <BuboMascot state="profile" size={64} />
        </View>
      </View>
      <View
        style={{
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          overflow: 'hidden',
        }}
      >
        <Board width={width} />
        {rows.map((row, index) => (
          <View key={index}>
            <View
              style={{
                height: CAVITY,
                flexDirection: 'row',
                alignItems: 'flex-end',
                paddingHorizontal: SIDE + INSET,
                gap: GAP,
              }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[shelfPalette.boardShadow, shelfPalette.transparent]}
                style={[styles.topShadow, { left: SIDE, right: SIDE }]}
              />
              {row.map(({ item: entry, width: itemWidth }) =>
                entry.status === 'reading' ? (
                  <FaceOutBook
                    key={entry.id}
                    entry={entry}
                    width={itemWidth}
                    selected={entry.id === selectedId}
                    onPress={() => onSelect(entry)}
                  />
                ) : (
                  <Spine
                    key={entry.id}
                    entry={entry}
                    width={itemWidth}
                    selected={entry.id === selectedId}
                    onPress={() => onSelect(entry)}
                  />
                ),
              )}
            </View>
            <Board width={width} />
          </View>
        ))}
        <LinearGradient
          pointerEvents="none"
          colors={[shelfPalette.wood, shelfPalette.woodDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.side, { left: 0 }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[shelfPalette.woodDark, shelfPalette.wood]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.side, { right: 0 }]}
        />
      </View>
    </View>
  );
}

/** A wooden board: lit top face, front face, lower edge and the shadow it casts below. */
function Board({ width }: { width: number }) {
  return (
    <View style={{ width, height: BOARD_TOP + BOARD_FRONT + BOARD_SHADOW }}>
      <LinearGradient
        colors={[shelfPalette.woodTop, shelfPalette.wood]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ height: BOARD_TOP }}
      />
      <LinearGradient
        colors={[shelfPalette.wood, shelfPalette.woodDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          height: BOARD_FRONT,
          borderBottomWidth: 2,
          borderBottomColor: shelfPalette.woodEdge,
        }}
      />
      <LinearGradient
        colors={[shelfPalette.boardShadow, shelfPalette.transparent]}
        style={{ height: BOARD_SHADOW }}
      />
    </View>
  );
}

function Spine({
  entry,
  width,
  selected,
  onPress,
}: {
  entry: ShelfEntry;
  width: number;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const lift = useMotionValue(selected ? -16 : 0, theme.motion.base);
  const palette =
    coverPalettes[stableBucket(entry.book.title, coverPalettes.length)] ?? coverPalettes[0];
  const height = Math.round((CAVITY - 10) * spineHeightRatio(entry.book.title));
  const labelLength = height - 40;
  const fontSize = width < 28 ? 10 : 12;
  const lineHeight = fontSize + 4;
  const slop = Math.max(0, Math.ceil((theme.sizes.touchTarget - width) / 2));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.book.title}${entry.book.author ? `, de ${entry.book.author}` : ''}`}
      accessibilityHint="Tira o livro da estante para ver a capa"
      accessibilityState={{ selected }}
      hitSlop={{ left: slop, right: slop, top: 8, bottom: 8 }}
      onPress={() => {
        haptics.press();
        onPress();
      }}
    >
      <Animated.View
        style={{
          width,
          height,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          overflow: 'hidden',
          backgroundColor: palette?.face,
          opacity: selected ? 0.45 : 1,
          transform: [{ translateY: lift }],
        }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[shelfPalette.spineLight, shelfPalette.transparent, shelfPalette.spineShade]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.band, { top: 10, backgroundColor: palette?.accent }]} />
        <View style={[styles.band, { bottom: 12, backgroundColor: palette?.accent }]} />
        <Text
          variant="label"
          numberOfLines={1}
          style={{
            position: 'absolute',
            width: labelLength,
            left: (width - labelLength) / 2,
            top: height / 2 - lineHeight / 2,
            fontSize,
            lineHeight,
            color: palette?.text,
            textAlign: 'center',
            transform: [{ rotate: '90deg' }],
          }}
        >
          {entry.book.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function FaceOutBook({
  entry,
  width,
  selected,
  onPress,
}: {
  entry: ShelfEntry;
  width: number;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const lift = useMotionValue(selected ? -16 : 0, theme.motion.base);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.book.title}${entry.book.author ? `, de ${entry.book.author}` : ''}, lendo agora`}
      accessibilityHint="Tira o livro da estante para ver a capa"
      accessibilityState={{ selected }}
      hitSlop={{ top: 8, bottom: 8 }}
      onPress={() => {
        haptics.press();
        onPress();
      }}
      style={{ width, alignItems: 'center' }}
    >
      <Animated.View
        style={{
          opacity: selected ? 0.45 : 1,
          transform: [{ perspective: 800 }, { translateY: lift }, { rotateY: '-10deg' }],
        }}
      >
        <BookCover
          title={entry.book.title}
          author={entry.book.author}
          coverUrls={entry.book.coverUrls}
          width={FACE_OUT_COVER}
          priority="high"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topShadow: { position: 'absolute', top: 0, height: 26 },
  side: { position: 'absolute', top: 0, bottom: 0, width: SIDE },
  band: { position: 'absolute', left: 4, right: 4, height: 3, borderRadius: 2, opacity: 0.9 },
});
