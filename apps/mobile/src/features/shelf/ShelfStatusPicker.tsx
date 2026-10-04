import { type ShelfEntry } from '@bubo/contracts';
import { type ReadingStatus } from '@bubo/domain';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Icon, InlineMessage, Text } from '../../design-system';
import { useUpdateShelfEntry } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { STATUS_META, STATUS_ORDER } from './labels';

/** The same real shelf statuses are available from the list and the book detail. */
export function ShelfStatusPicker({
  entry,
  userId,
  compact = false,
}: {
  entry: ShelfEntry;
  userId: string;
  compact?: boolean;
}) {
  const theme = useTheme();
  const update = useUpdateShelfEntry(userId, entry.id);
  const [expanded, setExpanded] = useState(!compact);

  function change(status: ReadingStatus) {
    if (status === entry.status || update.isPending) return;
    update.mutate(
      { status },
      { onSuccess: () => haptics.success(), onError: () => haptics.error() },
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {compact ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {entry.status !== 'finished' ? (
            <>
              {entry.status !== 'reading' ? (
                <Button
                  label="Lendo"
                  accessibilityLabel={`Marcar ${entry.book.title} como lendo`}
                  variant="secondary"
                  icon="auto-stories"
                  size="md"
                  compact
                  style={{ flex: 1 }}
                  disabled={update.isPending}
                  loading={update.isPending && update.variables?.status === 'reading'}
                  onPress={() => change('reading')}
                />
              ) : null}
              <Button
                label="Já li"
                accessibilityLabel={`Marcar ${entry.book.title} como lido`}
                variant="secondary"
                icon="check-circle-outline"
                size="md"
                compact
                style={{ flex: 1 }}
                disabled={update.isPending}
                loading={update.isPending && update.variables?.status === 'finished'}
                onPress={() => change('finished')}
              />
            </>
          ) : (
            <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
              Na sua lista de lidos
            </Text>
          )}
          <Button
            label={expanded ? 'Fechar opções de status' : `Mudar status de ${entry.book.title}`}
            accessibilityHint="Quero ler, lendo, lido, pausado ou abandonado"
            variant="secondary"
            icon={expanded ? 'expand-less' : 'more-horiz'}
            iconOnly
            size="md"
            disabled={update.isPending}
            onPress={() => setExpanded((value) => !value)}
          />
        </View>
      ) : null}
      {expanded ? (
        <>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`Status de ${entry.book.title}`}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
          >
            {STATUS_ORDER.map((status) => {
              const selected = entry.status === status;
              const busy = update.isPending && update.variables?.status === status;
              return (
                <Pressable
                  key={status}
                  accessibilityRole="radio"
                  accessibilityLabel={status === 'finished' ? 'Já li' : STATUS_META[status].label}
                  accessibilityState={{ checked: selected, disabled: update.isPending, busy }}
                  disabled={update.isPending}
                  onPress={() => change(status)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    minHeight: theme.sizes.touchTarget,
                    paddingHorizontal: theme.spacing.md,
                    borderWidth: theme.sizes.borderWidth,
                    borderRadius: theme.radii.pill,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
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
                      name={selected ? 'check' : STATUS_META[status].icon}
                      size={18}
                      color={selected ? 'onPrimary' : 'accentText'}
                    />
                  )}
                  <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
                    {status === 'finished' ? 'Já li' : STATUS_META[status].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!compact ? (
            <Text variant="bodySm" color="textMuted">
              Marque como já lido mesmo se leu antes de usar o Bubo. Isso organiza a estante; XP e
              sequência vêm das suas sessões de leitura.
            </Text>
          ) : null}
        </>
      ) : null}
      {update.isError ? (
        <InlineMessage tone="error" message="Não foi possível salvar o status. Tente novamente." />
      ) : null}
    </View>
  );
}
