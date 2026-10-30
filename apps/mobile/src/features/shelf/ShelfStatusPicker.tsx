import { type ShelfEntry, type UpdateShelfEntryRequest } from '@bubo/contracts';
import { type ComponentProps, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Icon, InlineMessage, Text } from '../../design-system';
import { useUpdateShelfEntry } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { STATUS_META } from './labels';

type Choice = 'want_to_read' | 'reading' | 'finished' | 'rereading' | 'paused' | 'abandoned';

const CHOICES: { id: Choice; label: string; icon: ComponentProps<typeof Icon>['name'] }[] = [
  { id: 'want_to_read', label: 'Quero ler', icon: STATUS_META.want_to_read.icon },
  { id: 'reading', label: 'Lendo', icon: STATUS_META.reading.icon },
  { id: 'finished', label: 'Lido', icon: STATUS_META.finished.icon },
  { id: 'rereading', label: 'Relendo', icon: 'replay' },
  { id: 'paused', label: 'Pausado', icon: STATUS_META.paused.icon },
  { id: 'abandoned', label: 'Abandonei', icon: STATUS_META.abandoned.icon },
];

function currentChoice(entry: ShelfEntry): Choice {
  if (entry.status === 'reading' && entry.rereading) return 'rereading';
  return entry.status;
}

/**
 * Status of a shelf book, changed from the book page (ADR-046 order: Quero ler, Lendo, Lido,
 * Relendo, Pausado, Abandonei). "Lido" opens the rating popup; "Relendo" restarts from page 0
 * after a confirmation and ends when the book is finished again.
 */
export function ShelfStatusPicker({ entry, userId }: { entry: ShelfEntry; userId: string }) {
  const theme = useTheme();
  const update = useUpdateShelfEntry(userId, entry.id);
  const [pending, setPending] = useState<Choice | null>(null);
  const selectedChoice = currentChoice(entry);

  function send(choice: Choice, patch: UpdateShelfEntryRequest) {
    setPending(choice);
    update.mutate(patch, {
      onSuccess: () => haptics.success(),
      onError: () => haptics.error(),
      onSettled: () => setPending(null),
    });
  }

  function change(choice: Choice) {
    if (choice === selectedChoice || update.isPending) return;
    if (choice === 'rereading') {
      Alert.alert(
        'Reler do começo?',
        'A página volta para 0. Suas sessões, cards e nota continuam.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Reler',
            onPress: () => send(choice, { status: 'reading', rereading: true, currentPage: 0 }),
          },
        ],
      );
      return;
    }
    send(
      choice,
      choice === 'reading' ? { status: 'reading', rereading: false } : { status: choice },
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`Status de ${entry.book.title}`}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: theme.spacing.sm,
        }}
      >
        {CHOICES.map((choice) => {
          const selected = selectedChoice === choice.id;
          const busy = pending === choice.id;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="radio"
              accessibilityLabel={choice.id === 'finished' ? 'Já li' : choice.label}
              accessibilityState={{ checked: selected, disabled: update.isPending, busy }}
              disabled={update.isPending}
              onPress={() => change(choice.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xs,
                minHeight: theme.sizes.touchTarget,
                paddingHorizontal: theme.spacing.md,
                borderWidth: theme.sizes.borderWidth,
                borderRadius: theme.radii.pill,
                borderColor: selected ? theme.colors.primaryRim : theme.colors.border,
                backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                opacity: update.isPending && !busy ? 0.5 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator
                  color={selected ? theme.colors.onPrimary : theme.colors.primary}
                />
              ) : (
                <Icon
                  name={selected ? 'check' : choice.icon}
                  size={18}
                  color={selected ? 'onPrimary' : 'accentText'}
                />
              )}
              <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {update.isError ? (
        <InlineMessage tone="error" message="Não foi possível salvar o status. Tente novamente." />
      ) : null}
    </View>
  );
}
