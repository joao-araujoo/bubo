import { stableBucket } from '@bubo/domain';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { coverPalettes, useTheme } from '../theme';
import { Text } from './Text';

type Props = {
  title: string;
  author?: string | null;
  /** Ordered https candidates from the API. Empty → typographic cover. */
  coverUrls?: readonly string[];
  width: number;
  /** Covers are 2:3 unless told otherwise. */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A book cover that never breaks (ADR-016). The typographic cover (author in caps, title in heavy
 * type, on a palette picked from the title) is always drawn underneath; each image candidate is
 * tried in order on top of it and dropped on error or when it is a blank placeholder. Images are
 * cached in memory + disk by expo-image, so shelves open instantly the second time.
 */
export function BookCover({ title, author, coverUrls = [], width, height, style }: Props) {
  const theme = useTheme();
  const coverHeight = height ?? Math.round(width * 1.5);
  const [index, setIndex] = useState(0);
  const key = coverUrls.join('|');
  // A different book (or new candidates) starts over from the first candidate.
  useEffect(() => setIndex(0), [key]);

  const source = coverUrls[index];
  const palette = coverPalettes[stableBucket(title, coverPalettes.length)] ?? coverPalettes[0];
  const small = width < 72;
  const radius = small ? theme.radii.sm : theme.radii.md;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Capa de ${title}${author ? `, de ${author}` : ''}`}
      style={[
        styles.frame,
        { width, height: coverHeight, borderRadius: radius, backgroundColor: palette?.face },
        style,
      ]}
    >
      <View
        style={[
          styles.fallback,
          { padding: small ? theme.spacing.xs + 2 : theme.spacing.md, gap: theme.spacing.xs },
        ]}
      >
        <View style={[styles.spine, { backgroundColor: palette?.spine }]} />
        {author && !small ? (
          <Text
            variant="caption"
            numberOfLines={1}
            style={{ color: palette?.muted, fontSize: width < 110 ? 8 : 10, letterSpacing: 1 }}
          >
            {author}
          </Text>
        ) : null}
        <View style={styles.titleBlock}>
          <Text
            variant="title"
            numberOfLines={small ? 3 : 4}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{
              color: palette?.text,
              fontSize: Math.max(9, Math.round(width / 7.5)),
              lineHeight: Math.max(11, Math.round(width / 6)),
            }}
          >
            {title}
          </Text>
          <View
            style={{
              width: Math.round(width / 5),
              height: small ? 2 : 3,
              borderRadius: 2,
              backgroundColor: palette?.accent,
            }}
          />
        </View>
      </View>
      {source ? (
        <Image
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={source}
          transition={theme.motion.base}
          accessible={false}
          onError={() => setIndex((current) => current + 1)}
          onLoad={(event) => {
            // Some sources answer with a 1×1 or tiny "no cover" placeholder: treat it as missing.
            if (event.source.width < 20 || event.source.height < 20) {
              setIndex((current) => current + 1);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  fallback: { flex: 1, justifyContent: 'space-between' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  titleBlock: { gap: 6 },
});
