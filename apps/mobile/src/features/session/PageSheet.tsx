import { nextReadingMilestone } from '@bubo/domain';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, InlineMessage, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { fontFamily, readingPalette, useTheme } from '../../theme';
import { SceneButton } from './scene';

const MILESTONE_CHIP: Record<25 | 50 | 75 | 100, string> = {
  25: 'Um quarto do livro',
  50: 'Metade do livro',
  75: 'Três quartos',
  100: 'Fim do livro',
};

/** The page typed in the sheet, or the reason it cannot be used. */
export function validateEndPage(
  value: string,
  startPage: number,
  totalPages: number | null,
): { page: number; error: null } | { page: null; error: string } {
  const page = Number(value.trim());
  if (
    !/^\d+$/.test(value.trim()) ||
    page < startPage ||
    (totalPages !== null && page > totalPages)
  ) {
    return {
      page: null,
      error:
        totalPages !== null
          ? `Escolha uma página entre ${startPage} e ${totalPages}.`
          : `Escolha uma página a partir de ${startPage}.`,
    };
  }
  return { page, error: null };
}

/**
 * "Até que página você foi?" (ADR-044): a big page number with − / + steppers, quick jumps (+5,
 * +10, the next quarter of the book) and direct typing. The night tone belongs to the timer; the
 * day tone reopens it from the recall card.
 */
export function PageSheet({
  visible,
  tone,
  startPage,
  totalPages,
  initialValue,
  confirmLabel,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  tone: 'night' | 'day';
  startPage: number;
  totalPages: number | null;
  initialValue: string;
  confirmLabel: string;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (page: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialValue);
  const [invalid, setInvalid] = useState<string | null>(null);
  const night = tone === 'night';
  const ink = night ? readingPalette.nightText : theme.colors.text;
  const muted = night ? readingPalette.nightMuted : theme.colors.textMuted;
  const glass = night ? readingPalette.glass : theme.colors.surfaceMuted;
  const glassBorder = night ? readingPalette.glassBorder : theme.colors.border;

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setInvalid(null);
    }
  }, [visible, initialValue]);

  const current = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const read = current === null ? null : current - startPage;
  const milestone =
    totalPages !== null
      ? nextReadingMilestone(Math.max(startPage, current ?? 0), totalPages)
      : null;

  function setPage(next: number) {
    const max = totalPages ?? Number.MAX_SAFE_INTEGER;
    const clamped = Math.min(max, Math.max(startPage, next));
    haptics.selection();
    setValue(String(clamped));
    setInvalid(null);
  }

  function confirm() {
    const checked = validateEndPage(value, startPage, totalPages);
    if (checked.page === null) {
      haptics.warning();
      setInvalid(checked.error);
      return;
    }
    onConfirm(checked.page);
  }

  const base = current ?? startPage;
  const chips = [
    { label: '+5', page: base + 5 },
    { label: '+10', page: base + 10 },
    ...(milestone
      ? [
          {
            label: `${MILESTONE_CHIP[milestone.percent]} (${milestone.page})`,
            page: milestone.page,
          },
        ]
      : []),
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={busy ? undefined : onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: night ? readingPalette.scrim : theme.colors.scrim,
          }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel="Até que página você foi?"
          style={{
            maxHeight: '90%',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: night ? readingPalette.nightSheet : theme.colors.surface,
            paddingBottom: insets.bottom + theme.spacing.xl,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              marginTop: theme.spacing.md,
              borderRadius: theme.radii.pill,
              backgroundColor: night ? readingPalette.sheetHandle : theme.colors.purpleLight,
            }}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: theme.sizes.gutter + 2,
              paddingTop: theme.spacing.md,
              gap: theme.spacing.lg,
            }}
          >
            <View style={{ alignItems: 'center', gap: theme.spacing.xxs }}>
              <Text
                variant="title"
                accessibilityRole="header"
                align="center"
                style={{ color: ink }}
              >
                Até que página você foi?
              </Text>
              <Text variant="bodyStrong" align="center" style={{ color: muted }}>
                {read === null || read < 0
                  ? `Você começou na página ${startPage}.`
                  : read === 0
                    ? 'Sem páginas novas desta vez, tudo bem.'
                    : read === 1
                      ? '1 página nesta leitura'
                      : `${read} páginas nesta leitura`}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.lg,
              }}
            >
              <StepButton
                label="−"
                accessibilityLabel="Uma página a menos"
                disabled={busy || base <= startPage}
                color={ink}
                face={glass}
                border={glassBorder}
                onPress={() => setPage(base - 1)}
              />
              <TextInput
                value={value}
                onChangeText={(text) => {
                  setValue(text.replace(/\D/g, '').slice(0, 5));
                  setInvalid(null);
                }}
                editable={!busy}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={5}
                accessibilityLabel="Página em que você parou"
                accessibilityHint="Digite a página ou use os botões de menos e mais"
                style={{
                  minWidth: 130,
                  paddingVertical: 0,
                  textAlign: 'center',
                  fontFamily: fontFamily.black,
                  fontSize: 64,
                  lineHeight: 72,
                  color: night ? readingPalette.gold : theme.colors.accentText,
                  fontVariant: ['tabular-nums'],
                }}
              />
              <StepButton
                label="+"
                accessibilityLabel="Uma página a mais"
                disabled={busy || (totalPages !== null && base >= totalPages)}
                color={ink}
                face={glass}
                border={glassBorder}
                onPress={() => setPage(base + 1)}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {chips.map((chip) => (
                <Pressable
                  key={chip.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Ir para a página ${Math.min(chip.page, totalPages ?? chip.page)}`}
                  disabled={busy}
                  onPress={() => setPage(chip.page)}
                  style={({ pressed }) => ({
                    minHeight: theme.sizes.touchTarget,
                    paddingHorizontal: theme.spacing.lg,
                    justifyContent: 'center',
                    borderRadius: theme.radii.input,
                    borderWidth: 1.5,
                    borderColor: glassBorder,
                    backgroundColor: glass,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text variant="label" style={{ color: ink }}>
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {invalid || error ? (
              <InlineMessage tone="error" message={invalid ?? error ?? ''} />
            ) : null}
            {night ? (
              <SceneButton variant="gold" label={confirmLabel} loading={busy} onPress={confirm} />
            ) : (
              <Button label={confirmLabel} loading={busy} onPress={confirm} />
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StepButton({
  label,
  accessibilityLabel,
  disabled,
  color,
  face,
  border,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  color: string;
  face: string;
  border: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 58,
        height: 58,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: border,
        backgroundColor: face,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      <Text variant="display" style={{ color, fontSize: 28, lineHeight: 34 }}>
        {label}
      </Text>
    </Pressable>
  );
}
