import { type MemoryPathStep, type ReviewOutcome, MEMORY_PATH_MAX_PAST } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, type ChipTone, Icon, SectionHeader, Text } from '../../design-system';
import { type ColorTokens, useTheme } from '../../theme';
import { dueLabel } from '../recall/grades';
import { shortDate } from './labels';

type IconName = ComponentProps<typeof Icon>['name'];

/** Same words, icons and colours as the review buttons (features/recall/grades.ts). */
const OUTCOME_META: Record<
  ReviewOutcome,
  {
    label: string;
    icon: IconName;
    tone: ChipTone;
    node: keyof ColorTokens;
    glyph: keyof ColorTokens;
  }
> = {
  remembered: {
    label: 'Lembrei',
    icon: 'check',
    tone: 'success',
    node: 'success',
    glyph: 'onSuccess',
  },
  almost: { label: 'Quase', icon: 'psychology', tone: 'gold', node: 'warning', glyph: 'text' },
  forgot: {
    label: 'Esqueci',
    icon: 'replay',
    tone: 'primary',
    node: 'purpleLight',
    glyph: 'onPrimary',
  },
};

const NODE = 32;

function minutesLabel(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function Node({ step }: { step: MemoryPathStep }) {
  const theme = useTheme();
  const base = {
    width: NODE,
    height: NODE,
    borderRadius: theme.radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  if (step.kind === 'reading') {
    return (
      <View style={[base, { backgroundColor: theme.colors.primary }]}>
        <Icon name="auto-stories" size={18} color="onPrimary" />
      </View>
    );
  }
  if (step.kind === 'review') {
    const meta = OUTCOME_META[step.outcome];
    return (
      <View style={[base, { backgroundColor: theme.colors[meta.node] }]}>
        <Icon name={meta.icon} size={18} color={meta.glyph} />
      </View>
    );
  }
  if (step.isDue) {
    return (
      <View
        style={[
          base,
          {
            backgroundColor: theme.colors.primarySoft,
            borderWidth: theme.sizes.borderWidth + 1,
            borderColor: theme.colors.primary,
          },
        ]}
      >
        <View
          style={{
            width: NODE / 2,
            height: NODE / 2,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.primary,
          }}
        />
      </View>
    );
  }
  return (
    <View
      style={[
        base,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Icon name="lock-outline" size={16} color="textMuted" />
    </View>
  );
}

function StepBody({ step, today }: { step: MemoryPathStep; today: string }) {
  const theme = useTheme();
  const router = useRouter();
  const panel = {
    flex: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: theme.sizes.borderWidth,
  };

  if (step.kind === 'next') {
    const cards = step.cardCount === 1 ? '1 card' : `${step.cardCount} cards`;
    if (step.isDue) {
      return (
        <View
          style={[
            panel,
            { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              Revisão de hoje
            </Text>
            <Chip label="Hoje" tone="primary" eyebrow />
          </View>
          <Text variant="bodySm" color="accentText">
            {cards} deste livro {step.cardCount === 1 ? 'espera' : 'esperam'} você lembrar sem
            espiar.
          </Text>
          <Button
            label="Revisar agora"
            icon="psychology"
            size="md"
            fullWidth
            onPress={() => router.push('/revisao')}
          />
        </View>
      );
    }
    return (
      <View
        accessible
        accessibilityLabel={`Próxima revisão em ${dueLabel(step.localDate, today)}: ${cards}`}
        style={[
          panel,
          { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text variant="bodyStrong" color="textMuted" style={{ flex: 1 }}>
            Próxima revisão
          </Text>
          <Text variant="bodySm" color="textMuted">
            {dueLabel(step.localDate, today)}
          </Text>
        </View>
        <Text variant="bodySm" color="textMuted">
          {cards} {step.cardCount === 1 ? 'volta' : 'voltam'} nesse dia. Voltar na hora certa é o
          que fixa a memória.
        </Text>
      </View>
    );
  }

  const date = shortDate(step.localDate);
  const title = step.kind === 'reading' ? 'Sessão de leitura' : 'Revisão sem espiar';
  const detail =
    step.kind === 'reading'
      ? step.pagesRead > 0
        ? `Págs. ${step.startPage} → ${step.endPage} · ${minutesLabel(step.focusedSeconds)} de foco`
        : `${minutesLabel(step.focusedSeconds)} de foco`
      : 'Você tentou lembrar antes de ver a resposta.';
  const outcome = step.kind === 'review' ? OUTCOME_META[step.outcome] : null;

  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${date}. ${outcome ? `Resultado: ${outcome.label}.` : detail}`}
      style={[
        panel,
        { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceMuted },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {title}
        </Text>
        {outcome ? (
          <Chip label={outcome.label} tone={outcome.tone} />
        ) : (
          <Text variant="bodySm" color="textMuted">
            {date}
          </Text>
        )}
      </View>
      <Text variant="bodySm" color="textMuted">
        {outcome ? `${date} · ${detail}` : detail}
      </Text>
    </View>
  );
}

/**
 * "Caminho de memória" (Stitch `bubo_detalhe_do_livro_caminho_de_mem_ria_2`): the book's real
 * reading sessions and graded reviews, then the next scheduled review. No invented phases or
 * retention percentages — only what the reader recorded.
 */
export function MemoryPath({
  steps,
  today,
  truncated,
}: {
  steps: MemoryPathStep[];
  today: string;
  /** More recorded activity exists than the steps shown. */
  truncated: boolean;
}) {
  const theme = useTheme();
  return (
    <Card>
      <SectionHeader title="Caminho de memória" icon="timeline" />
      {steps.length === 0 ? (
        <Text variant="body" color="textMuted">
          Seu caminho começa na primeira sessão de leitura. Cada revisão deste livro também aparece
          aqui.
        </Text>
      ) : (
        <View>
          {truncated ? (
            <Text variant="bodySm" color="textMuted" style={{ marginBottom: theme.spacing.sm }}>
              Mostrando as {MEMORY_PATH_MAX_PAST} etapas mais recentes.
            </Text>
          ) : null}
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            return (
              <View
                key={step.kind === 'next' ? 'next' : `${step.kind}-${step.id}`}
                style={{ flexDirection: 'row', gap: theme.spacing.md }}
              >
                <View style={{ width: NODE, alignItems: 'center' }}>
                  <Node step={step} />
                  {last ? null : (
                    <View
                      style={{
                        flex: 1,
                        width: theme.sizes.borderWidth,
                        minHeight: theme.spacing.md,
                        backgroundColor: theme.colors.border,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: last ? 0 : theme.spacing.md }}>
                  <StepBody step={step} today={today} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}
