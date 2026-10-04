import { coverUrlForWidth, stableBucket } from '@bubo/domain';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { coverPalettes, useTheme } from '../theme';
import { useReducedMotion } from '../lib/motion';
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
  /** Covers above the fold (carousels' first cards) load before the rest. */
  priority?: 'low' | 'normal' | 'high';
};

/**
 * A book cover that never breaks (ADR-016, ADR-031). While an image candidate loads, the frame is
 * a quiet placeholder; the typographic cover (author in caps, title in heavy type, on a palette
 * picked from the title) appears only when the book has no usable image, so readers never see a
 * "fake" cover flash before the real one. Candidates are tried in order and dropped on error or
 * when they are a blank placeholder. Small covers request smaller renditions. Images are cached
 * in memory + disk by expo-image, so shelves open instantly the second time.
 */
export function BookCover({
  title,
  author,
  coverUrls = [],
  width,
  height,
  style,
  priority = 'normal',
}: Props) {
  const candidates = [...new Set(coverUrls.map((url) => coverUrlForWidth(url, width)))];
  return (
    <CoverFrame
      key={candidates.join('|')}
      title={title}
      author={author}
      candidates={candidates}
      width={width}
      height={height}
      style={style}
      priority={priority}
    />
  );
}

function CoverFrame({
  title,
  author,
  candidates,
  width,
  height,
  style,
  priority,
}: Omit<Props, 'coverUrls'> & { candidates: readonly string[] }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const coverHeight = height ?? Math.round(width * 1.5);
  const [index, setIndex] = useState(0);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const source = candidates[index];
  const waiting = source !== undefined && loadedSource !== source;
  useEffect(() => {
    if (!source || loadedSource === source) return;
    // A stalled image must not leave a blank frame forever; try the next real candidate.
    const timer = setTimeout(
      () => setIndex((current) => (current === index ? current + 1 : current)),
      6_000,
    );
    return () => clearTimeout(timer);
  }, [source, loadedSource, index]);
  const palette = coverPalettes[stableBucket(title, coverPalettes.length)] ?? coverPalettes[0];
  const small = width < 72;
  const radius = small ? theme.radii.sm : theme.radii.md;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Capa de ${title}${author ? `, de ${author}` : ''}${waiting ? ', carregando' : ''}`}
      style={[
        styles.frame,
        {
          width,
          height: coverHeight,
          borderRadius: radius,
          backgroundColor: source ? theme.colors.surfaceMuted : palette?.face,
        },
        style,
      ]}
    >
      {source ? null : (
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
      )}
      {source ? (
        <Image
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={source}
          priority={priority}
          transition={reducedMotion ? 0 : theme.motion.fast}
          accessible={false}
          onError={() => setIndex((current) => (current === index ? current + 1 : current))}
          onLoad={(event) => {
            // Some sources answer with a 1×1 or tiny "no cover" placeholder: treat it as missing.
            if (event.source.width < 20 || event.source.height < 20) {
              setIndex((current) => (current === index ? current + 1 : current));
            } else {
              setLoadedSource(source);
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
