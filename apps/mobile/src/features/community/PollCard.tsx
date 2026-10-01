import { type ClubPoll } from '@bubo/contracts';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon, Pill, Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { closesLabel, votesLabel } from './meta';
import { SpoilerVeil } from './SpoilerVeil';

type Option = ClubPoll['options'][number];

/** One Stitch poll option: bordered row, result fill behind the text once results are visible. */
export function PollOptionRow({
  option,
  index,
  resultsVisible,
  disabled,
  onPress,
  pending,
}: {
  option: Option;
  index: number;
  resultsVisible: boolean;
  disabled: boolean;
  onPress?: () => void;
  pending?: boolean;
}) {
  const theme = useTheme();
  const label = option.label ?? `Opção ${index + 1}`;
  return (
    <Pressable
      disabled={disabled || !onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: option.mine, disabled: disabled || !onPress }}
      accessibilityLabel={
        resultsVisible && option.percent !== null ? `${label}, ${option.percent}%` : label
      }
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={{
        minHeight: 52,
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: theme.radii.md,
        borderWidth: theme.sizes.borderWidth,
        borderColor: option.mine ? theme.colors.primary : theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      {resultsVisible && option.percent !== null ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${option.percent}%`,
            backgroundColor: option.mine ? theme.colors.primarySoft : theme.colors.surfaceMuted,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        }}
      >
        {pending ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: theme.sizes.borderWidth,
              borderColor: option.mine ? theme.colors.primary : theme.colors.textMuted,
              backgroundColor: option.mine ? theme.colors.primary : theme.colors.transparent,
            }}
          >
            {option.mine ? <Icon name="check" size={14} color="onPrimary" /> : null}
          </View>
        )}
        <Text variant="bodyStrong" style={{ flex: 1, fontSize: 14 }}>
          {label}
        </Text>
        {resultsVisible && option.percent !== null ? (
          <Text variant="label" color={option.mine ? 'accentText' : 'textMuted'}>
            {option.percent}%
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Stitch "Enquete ativa" card (forum and feed). Single-choice polls vote inline; results appear
 * only after voting (or when closed), so nobody follows the crowd.
 */
export function PollCard({
  poll,
  readerPage,
  onOpen,
  onReveal,
  onVote,
  votingOptionId,
  clubName,
}: {
  poll: ClubPoll;
  readerPage: number;
  onOpen: () => void;
  onReveal: () => void;
  onVote?: (optionId: string) => void;
  votingOptionId?: string | null;
  clubName?: string;
}) {
  const theme = useTheme();
  const voted = poll.options.some((option) => option.mine);
  const canVoteInline = poll.isOpen && !poll.multiple && !poll.locked && Boolean(onVote);
  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={theme.colors.purpleLight}
      rimColor={theme.colors.primarySoft}
      radius={20}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Pill caps icon="how-to-vote" label={poll.isOpen ? 'Enquete ativa' : 'Enquete encerrada'} />
        <Text
          variant="bodySm"
          color="textMuted"
          style={{ flex: 1, fontSize: 12 }}
          numberOfLines={1}
        >
          {`• ${closesLabel(poll.closesAt, poll.isOpen)}`}
        </Text>
        <Pill tone="success" label={votesLabel(poll.voterCount)} />
      </View>

      {poll.locked ? (
        <SpoilerVeil spoilerPage={poll.spoilerPage} readerPage={readerPage} onReveal={onReveal} />
      ) : (
        <>
          <View style={{ gap: 2 }}>
            <Text variant="bodyStrong" style={{ fontSize: 16, lineHeight: 22 }}>
              {poll.question}
            </Text>
            <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
              {[
                clubName,
                `Criada por ${poll.isMine ? 'você' : poll.author.name}`,
                poll.multiple ? 'várias respostas' : null,
              ]
                .filter(Boolean)
                .join(' • ')}
            </Text>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            {poll.options.map((option, index) => (
              <PollOptionRow
                key={option.id}
                option={option}
                index={index}
                resultsVisible={poll.resultsVisible}
                disabled={!canVoteInline}
                pending={votingOptionId === option.id}
                onPress={canVoteInline ? () => onVote?.(option.id) : undefined}
              />
            ))}
          </View>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          poll.argumentCount > 0 ? `Ver ${poll.argumentCount} argumentos` : 'Abrir enquete'
        }
        onPress={() => {
          haptics.selection();
          onOpen();
        }}
        style={{
          minHeight: 40,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingTop: theme.spacing.xs,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSoft,
        }}
      >
        {voted ? (
          <>
            <Icon name="insights" size={16} color="accentText" />
            <Text variant="bodySm" color="accentText" style={{ flex: 1, fontSize: 12 }}>
              Seu voto foi computado
            </Text>
          </>
        ) : (
          <Text variant="bodySm" color="textMuted" style={{ flex: 1, fontSize: 12 }}>
            {poll.isOpen
              ? poll.multiple
                ? 'Abra para escolher suas respostas'
                : 'Toque numa opção para votar'
              : 'Votação encerrada'}
          </Text>
        )}
        <Text variant="label" color="accentText" style={{ fontSize: 13 }}>
          {poll.argumentCount > 0 ? `Ver ${poll.argumentCount} argumentos` : 'Ver enquete'}
        </Text>
        <Icon name="chevron-right" size={18} color="accentText" />
      </Pressable>
    </Raised>
  );
}
