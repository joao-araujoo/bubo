import { coverUrlForWidth } from '@bubo/domain';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Book3D, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

const BACKDROP_HEIGHT = 300;

/**
 * Book page header (Skoob-style, ADR-042): the book's own cover, blurred and veiled, fills the top
 * band behind the 3D book; title, subtitle and author sit centred below. The backdrop reuses the
 * small cover rendition the lists already cached, so it costs no extra download.
 */
export function BookHero({
  title,
  subtitle,
  author,
  coverUrls,
  totalPages,
  children,
}: {
  title: string;
  subtitle?: string | null;
  author: string | null;
  coverUrls: readonly string[];
  totalPages: number | null;
  /** Rating, facts or status under the author. */
  children?: ReactNode;
}) {
  const theme = useTheme();
  const first = coverUrls[0];
  const backdrop = first ? coverUrlForWidth(first, 60) : null;
  return (
    <View
      style={{
        marginHorizontal: -theme.sizes.gutter,
        marginTop: -theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        paddingHorizontal: theme.sizes.gutter,
        alignItems: 'center',
        gap: theme.spacing.xs,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: BACKDROP_HEIGHT,
          overflow: 'hidden',
          backgroundColor: theme.colors.primarySoft,
        }}
      >
        {backdrop ? (
          <Image
            source={{ uri: backdrop }}
            blurRadius={28}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={theme.motion.base}
            accessible={false}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.backdropVeil }]} />
        <LinearGradient
          colors={[theme.colors.bgClear, theme.colors.bg]}
          start={{ x: 0, y: 0.35 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Book3D
        title={title}
        author={author}
        coverUrls={coverUrls}
        totalPages={totalPages}
        width={150}
        priority="high"
      />
      <Text
        variant="heading"
        accessibilityRole="header"
        align="center"
        numberOfLines={3}
        style={{ marginTop: theme.spacing.md }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="textMuted" align="center" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      <Text variant="bodyLg" color="accentText" align="center" numberOfLines={2}>
        {author ?? 'Autor desconhecido'}
      </Text>
      {children}
    </View>
  );
}

export type BookFact = { label: string; value: string };

/** Skoob-style fact columns ("412 · Páginas | 2017 · Ano | PT · Idioma"). Only known facts. */
export function BookFacts({ facts }: { facts: readonly BookFact[] }) {
  const theme = useTheme();
  if (!facts.length) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'stretch',
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.borderSoft,
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.md,
      }}
    >
      {facts.map((fact, index) => (
        <View
          key={fact.label}
          accessible
          accessibilityLabel={`${fact.label}: ${fact.value}`}
          style={{
            flex: 1,
            alignItems: 'center',
            gap: 2,
            paddingHorizontal: theme.spacing.xs,
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: theme.colors.borderSoft,
          }}
        >
          <Text variant="titleSm" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {fact.value}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {fact.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Synopsis that opens in five lines and expands on tap ("Ler mais"). */
export function Synopsis({ text }: { text: string | null }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const long = (text?.length ?? 0) > 280;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="titleSm" accessibilityRole="header">
        Sinopse
      </Text>
      <Text
        variant="body"
        color={text ? 'text' : 'textMuted'}
        numberOfLines={open || !long ? undefined : 5}
      >
        {text ?? 'As bibliotecas consultadas ainda não têm sinopse para este livro.'}
      </Text>
      {long ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Mostrar menos da sinopse' : 'Ler a sinopse inteira'}
          onPress={() => {
            haptics.selection();
            setOpen((value) => !value);
          }}
          style={{ minHeight: theme.sizes.touchTarget, justifyContent: 'center' }}
        >
          <Text variant="label" color="accentText">
            {open ? 'Mostrar menos' : 'Ler mais'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
