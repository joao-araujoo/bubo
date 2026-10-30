import { type BookCommunity, type ShelfEntry } from '@bubo/contracts';
import { type FinishForecast } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BookCover, Card, Icon, InlineMessage, Text } from '../../design-system';
import { useUpdateShelfEntry } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { RATING_LABELS } from '../../lib/rating-prompt';
import { type ColorTokens, useTheme } from '../../theme';
import { StarRating } from '../community/StarRating';
import { BookFacts } from './BookHero';

type IconName = ComponentProps<typeof Icon>['name'];

/**
 * Book page additions (ADR-046, after Skoob): anonymous numbers of Bubo readers, the reader's own
 * marks, the finish forecast and "quem leu também leu". Each block hides itself without data.
 */

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function dayMonth(isoDate: string) {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day ?? ''} de ${MONTHS[(month ?? 1) - 1] ?? ''}`;
}

/** "★ 4,7 · 12 avaliações" under the title, from five ratings on. */
export function CommunityRatingLine({ ratings }: { ratings: BookCommunity['ratings'] }) {
  const theme = useTheme();
  if (!ratings) return null;
  return (
    <View
      accessible
      accessibilityLabel={`Nota dos leitores ${ratings.average.toLocaleString('pt-BR')} de 5, ${ratings.count} avaliações`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
    >
      <StarRating value={Math.round(ratings.average)} size={15} />
      <Text variant="bodyStrong" style={{ fontFamily: theme.fontFamily.extrabold }}>
        {ratings.average.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
      </Text>
      <Text variant="bodySm" color="textMuted">
        · {ratings.count.toLocaleString('pt-BR')} avaliações
      </Text>
    </View>
  );
}

/** "Leitores no Bubo": distinct readers by status, never who. */
export function ReadersFacts({ readers }: { readers: BookCommunity['readers'] }) {
  const theme = useTheme();
  if (!readers) return null;
  const number = (value: number) => value.toLocaleString('pt-BR');
  return (
    <View style={{ gap: 6 }}>
      <Text variant="labelSm" color="textMuted">
        Leitores no Bubo
      </Text>
      <BookFacts
        facts={[
          { label: 'leram', value: number(readers.finished) },
          { label: 'lendo', value: number(readers.reading) },
          { label: 'querem ler', value: number(readers.wantToRead) },
          { label: 'largaram', value: number(readers.abandoned) },
        ]}
      />
      <View style={{ height: theme.spacing.xxs }} />
    </View>
  );
}

const MARKS: {
  key: 'favorite' | 'owned' | 'wishlist';
  label: string;
  on: IconName;
  off: IconName;
  ink: keyof ColorTokens;
  soft: keyof ColorTokens;
}[] = [
  {
    key: 'favorite',
    label: 'Favorito',
    on: 'favorite',
    off: 'favorite-border',
    ink: 'error',
    soft: 'errorSoft',
  },
  {
    key: 'owned',
    label: 'Tenho',
    on: 'inventory-2',
    off: 'inventory-2',
    ink: 'accentText',
    soft: 'primarySoft',
  },
  {
    key: 'wishlist',
    label: 'Desejado',
    on: 'card-giftcard',
    off: 'card-giftcard',
    ink: 'warningText',
    soft: 'goldSoft',
  },
];

/** Favorito / Tenho / Desejado: the reader's own marks, saved on tap. */
export function MarkToggles({ entry, userId }: { entry: ShelfEntry; userId: string }) {
  const theme = useTheme();
  const update = useUpdateShelfEntry(userId, entry.id);
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: theme.spacing.sm,
        }}
      >
        {MARKS.map((mark) => {
          const pending = update.isPending ? update.variables?.[mark.key] : undefined;
          const on = pending ?? entry[mark.key];
          return (
            <Pressable
              key={mark.key}
              accessibilityRole="switch"
              accessibilityLabel={mark.label}
              accessibilityState={{ checked: on, disabled: update.isPending }}
              disabled={update.isPending}
              onPress={() => {
                haptics.selection();
                update.mutate({ [mark.key]: !entry[mark.key] }, { onError: () => haptics.error() });
              }}
              style={({ pressed }) => ({
                minHeight: theme.sizes.touchTarget,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: theme.spacing.md + 2,
                borderRadius: theme.radii.pill,
                borderWidth: theme.sizes.borderWidth,
                borderColor: on ? theme.colors[mark.ink] : theme.colors.border,
                backgroundColor: on
                  ? theme.colors[mark.soft]
                  : pressed
                    ? theme.colors.primarySoft
                    : theme.colors.surface,
              })}
            >
              <Icon name={on ? mark.on : mark.off} size={17} color={on ? mark.ink : 'textMuted'} />
              <Text variant="label" color={on ? mark.ink : 'textMuted'} style={{ fontSize: 13 }}>
                {mark.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {update.isError ? (
        <InlineMessage tone="error" message="Não foi possível salvar agora. Tente de novo." />
      ) : null}
    </View>
  );
}

/** "No seu ritmo de 14 páginas por dia, termina em 9 dias, lá por 7 de nov." */
export function ForecastLine({ forecast }: { forecast: FinishForecast }) {
  const theme = useTheme();
  return (
    <View
      accessible
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: 10,
        paddingHorizontal: theme.spacing.md,
        borderRadius: 14,
        backgroundColor: theme.colors.bg,
      }}
    >
      <Icon name="event" size={20} color="accentText" />
      <Text variant="bodySm" style={{ flex: 1, fontFamily: theme.fontFamily.semibold }}>
        No seu ritmo de {forecast.pagesPerDay} {forecast.pagesPerDay === 1 ? 'página' : 'páginas'}{' '}
        por dia, termina em{' '}
        <Text variant="bodySm" style={{ fontFamily: theme.fontFamily.extrabold }}>
          {forecast.days === 1 ? '1 dia' : `${forecast.days} dias`}
        </Text>
        , lá por {dayMonth(forecast.date)}.
      </Text>
    </View>
  );
}

/** "Sua nota" (private, saved on tap) and, from five ratings on, "Nota dos leitores". */
export function RatingCard({
  entry,
  userId,
  ratings,
}: {
  entry: ShelfEntry;
  userId: string;
  ratings: BookCommunity['ratings'] | undefined;
}) {
  const theme = useTheme();
  const update = useUpdateShelfEntry(userId, entry.id);
  const value = update.isPending ? (update.variables?.rating ?? entry.rating) : entry.rating;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleSm" accessibilityRole="header">
          Sua nota
        </Text>
        <Text variant="bodySm" color={value ? 'accentText' : 'textMuted'}>
          {update.isError
            ? 'Não foi possível salvar.'
            : value
              ? RATING_LABELS[value]
              : 'Toque para avaliar'}
        </Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        <StarRating
          value={value}
          size={32}
          disabled={update.isPending}
          onChange={(rating) =>
            update.mutate(
              { rating },
              { onSuccess: () => haptics.success(), onError: () => haptics.error() },
            )
          }
        />
      </View>
      <View
        style={{
          gap: theme.spacing.sm,
          paddingTop: theme.spacing.md,
          borderTopWidth: theme.sizes.borderWidth,
          borderTopColor: theme.colors.borderSoft,
        }}
      >
        <Text variant="label" style={{ fontSize: 15 }}>
          Nota dos leitores
        </Text>
        {ratings ? (
          ratings.distribution.map((row) => (
            <View
              key={row.stars}
              accessible
              accessibilityLabel={`${row.stars} estrelas: ${row.percent}%`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
            >
              <Text variant="label" color="textMuted" style={{ width: 26, fontSize: 13 }}>
                {row.stars}★
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: theme.radii.pill,
                  overflow: 'hidden',
                  backgroundColor: theme.colors.surfaceMuted,
                }}
              >
                <View
                  style={{
                    width: `${row.percent}%`,
                    height: '100%',
                    borderRadius: theme.radii.pill,
                    backgroundColor: theme.colors.gold,
                  }}
                />
              </View>
              <Text variant="labelSm" color="textMuted" align="right" style={{ width: 40 }}>
                {row.percent}%
              </Text>
            </View>
          ))
        ) : (
          <Text variant="bodySm" color="textMuted">
            Aparece quando pelo menos 5 leitores do Bubo avaliarem este livro. Sua nota entra só na
            conta, nunca com seu nome.
          </Text>
        )}
      </View>
    </Card>
  );
}

/** "Quem leu também leu": catalog books finished by other readers of this one. */
export function AlsoRead({ items }: { items: BookCommunity['alsoRead'] }) {
  const theme = useTheme();
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: theme.spacing.sm + 2 }}>
      <Text variant="titleSm" accessibilityRole="header">
        Quem leu também leu
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -theme.sizes.gutter }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingHorizontal: theme.sizes.gutter,
          paddingVertical: theme.spacing.xxs,
        }}
      >
        {items.map((item) => (
          <Pressable
            key={item.catalogId}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.percent}% dos leitores também leram`}
            onPress={() => {
              haptics.selection();
              router.push({ pathname: '/catalogo/[id]', params: { id: item.catalogId } });
            }}
            style={({ pressed }) => ({ width: 96, gap: 6, opacity: pressed ? 0.8 : 1 })}
          >
            <BookCover
              title={item.title}
              author={item.author}
              coverUrls={item.coverUrls}
              width={96}
            />
            <Text variant="label" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17 }}>
              {item.title}
            </Text>
            <Text variant="meta" color="textMuted">
              {item.percent}% também leram
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
