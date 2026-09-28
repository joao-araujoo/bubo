import { REPORT_DETAILS_MAX, type ReportRequest } from '@bubo/contracts';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, InlineMessage, Text, TextField } from '../../design-system';
import { ApiError } from '../../lib/api/client';
import { useReportContent } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { REPORT_REASONS } from './meta';

/**
 * Inline report form (not an Alert: Android alerts hold at most three buttons). After sending,
 * the item disappears for the reporter; three distinct reports hide it for everyone.
 */
export function ReportPanel({
  userId,
  target,
  onDone,
  onCancel,
}: {
  userId: string;
  target: Pick<ReportRequest, 'targetType' | 'targetId'>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const report = useReportContent(userId);
  const [reason, setReason] = useState<ReportRequest['reason'] | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!reason) {
      setError('Escolha um motivo.');
      return;
    }
    setError(null);
    try {
      await report.mutateAsync({
        ...target,
        reason,
        details: details.trim() ? details.trim().slice(0, REPORT_DETAILS_MAX) : null,
      });
      haptics.success();
      onDone();
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'NOT_FOUND'
          ? 'Esse conteúdo já foi removido.'
          : 'Não foi possível enviar a denúncia agora.',
      );
    }
  }

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceMuted,
      }}
    >
      <Text variant="bodyStrong" accessibilityRole="header">
        Por que você está denunciando?
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.xs }}>
        {REPORT_REASONS.map((option) => {
          const selected = option.value === reason;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => {
                haptics.selection();
                setReason(option.value);
              }}
              style={{
                minHeight: theme.sizes.touchTarget,
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radii.md,
                borderWidth: theme.sizes.borderWidth,
                borderColor: selected ? theme.colors.primary : theme.colors.borderSoft,
                backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
              }}
            >
              <Icon
                name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20}
                color={selected ? 'accentText' : 'textMuted'}
              />
              <Text variant="body" style={{ flex: 1 }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        label="Detalhes (opcional)"
        placeholder="Conte o que aconteceu"
        value={details}
        onChangeText={setDetails}
        maxLength={REPORT_DETAILS_MAX}
        multiline
      />
      <Text variant="bodySm" color="textMuted">
        O conteúdo some para você na hora. Com 3 denúncias ele fica oculto até o criador do clube
        revisar.
      </Text>
      {error ? <InlineMessage tone="error" message={error} /> : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button label="Cancelar" variant="secondary" size="md" compact onPress={onCancel} />
        <Button
          label="Enviar denúncia"
          icon="flag"
          size="md"
          compact
          loading={report.isPending}
          onPress={send}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
