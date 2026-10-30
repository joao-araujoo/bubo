import {
  SESSION_RECALL_FIELD_MAX_LENGTH,
  type AssessSessionResponse,
  type SessionRecall,
  type SessionResult,
  type ShelfEntry,
} from '@bubo/contracts';
import { toLocalIsoDate } from '@bubo/domain';
import {
  isSubstantialRecallAnswer,
  mentionsSomethingConcrete,
  recallAnswersRepeat,
} from '@bubo/scoring';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, TextInput, View, useWindowDimensions } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  FormScreen,
  Icon,
  InlineMessage,
  LinkButton,
  Text,
  Toggle,
} from '../../design-system';
import { type MascotPose } from '../../assets/registry';
import { ApiError } from '../../lib/api/client';
import { useAssessSession, useRecordSession } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { FadeIn, useAmbientLoop, useReducedMotion } from '../../lib/motion';
import { accentFontFamily, readingPalette, useTheme } from '../../theme';
import { clearSessionDraft, type SessionDraft, type SessionDraftPersist } from './draft-storage';
import { PageSheet, validateEndPage } from './PageSheet';
import { useConfirmLeave } from './useConfirmLeave';
import { formatDuration } from './useFocusTimer';

type RecallKey = keyof SessionRecall;
const KEYS: readonly RecallKey[] = ['idea', 'detail', 'connection'];
const LINE = 28;
const MIN_LINES = 7;
const MARGIN = 52;

/** The optional Gemini question, carried to the receipt (it used to sit above the save button). */
export type CoachNote = { question: string | null; unavailable: boolean };

export type SavedSession = {
  result: SessionResult;
  cleanupWarning?: string;
  coach: CoachNote;
  /** The streak grew with this session: the receipt continues to "Dias seguidos". */
  streakGrew: boolean;
};

const STEPS: Record<
  RecallKey,
  { label: string; starter: string; nudge: string; pose: MascotPose }
> = {
  idea: {
    label: 'Ideia',
    starter: 'Nessas páginas, ',
    nudge: 'Conta com suas palavras o que aconteceu, numa frase curta?',
    pose: 'curious',
  },
  detail: {
    label: 'Detalhe',
    starter: 'Um detalhe que me marcou foi ',
    nudge: 'Coloca um nome, lugar ou momento da história?',
    pose: 'thinking',
  },
  connection: {
    label: 'Conexão',
    starter: 'Isso me lembrou ',
    nudge: 'Isso te lembrou o quê? Uma pessoa, outro livro, uma dúvida…',
    pose: 'idea',
  },
};

const REPEAT_NUDGE = 'Essa ficou igual a outra resposta. Tenta outro ângulo?';

function prompt(key: RecallKey, startPage: number, endPage: number | null) {
  const range = endPage !== null && endPage > startPage ? `${startPage} a ${endPage}` : null;
  switch (key) {
    case 'idea':
      return range
        ? `Qual ideia ou cena ficou das páginas ${range}?`
        : 'Qual ideia ou cena ficou deste trecho?';
    case 'detail':
      return range
        ? 'Que detalhe dessas páginas você não quer esquecer?'
        : 'Que detalhe deste trecho você não quer esquecer?';
    case 'connection':
      return 'Isso te lembrou o quê? Uma pessoa, outro livro, uma pergunta…';
  }
}

/** Local mirror of the server checklist for one answer: substance, then no repeated text. */
function localCheck(recall: SessionRecall, key: RecallKey): 'ok' | 'thin' | 'repeat' {
  if (!isSubstantialRecallAnswer(recall[key])) return 'thin';
  const repeats = KEYS.some(
    (other) =>
      other !== key &&
      recall[other].trim() !== '' &&
      recallAnswersRepeat(recall[key], recall[other]),
  );
  return repeats ? 'repeat' : 'ok';
}

/**
 * "Lembrar sem espiar" as an index card (ADR-044): one question at a time on lined paper, folder
 * tabs, the reader's own handwriting and a "Guardado" stamp. Each stamp mirrors the server's
 * writing checklist locally; the final tap asks the server (the deliberate check of ADR-027) and,
 * when it passes, saves the session with the same idempotent submission as before.
 */
export function RecallStep({
  entry,
  userId,
  draft,
  persist,
  onDiscard,
  onSaved,
  streakBefore,
}: {
  entry: ShelfEntry;
  userId: string;
  draft: SessionDraft;
  persist: SessionDraftPersist;
  onDiscard: () => void;
  onSaved: (saved: SavedSession) => void;
  /** Streak before this session (from cached stats), to know whether saving grew it. */
  streakBefore: number | null;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const save = useRecordSession(userId);
  const check = useAssessSession();
  useConfirmLeave(!save.isSuccess);
  const total = entry.book.totalPages;
  const [page, setPage] = useState(draft.page);
  const [recall, setRecall] = useState<SessionRecall>(
    draft.submission?.recall ??
      draft.recall ?? {
        idea: draft.reflection.slice(0, SESSION_RECALL_FIELD_MAX_LENGTH),
        detail: '',
        connection: '',
      },
  );
  const [stamped, setStamped] = useState<ReadonlySet<RecallKey>>(() =>
    draft.submission
      ? new Set(KEYS)
      : new Set(KEYS.filter((key) => localCheck(recall, key) === 'ok')),
  );
  const [step, setStep] = useState<number>(() => {
    if (draft.submission) return KEYS.length - 1;
    const open = KEYS.findIndex((key) => localCheck(recall, key) !== 'ok');
    return open === -1 ? KEYS.length - 1 : open;
  });
  const [nudge, setNudge] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessSessionResponse | null>(null);
  const [coach, setCoach] = useState(false);
  const [pageSheet, setPageSheet] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [lines, setLines] = useState(MIN_LINES);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const checking = useRef(false);
  const [evaluating, setEvaluating] = useState(false);
  const [baseline, setBaseline] = useState(streakBefore);
  // Stats may arrive after the card opens; never adopt the refetch that follows our own save.
  if (baseline === null && streakBefore !== null && !sending) setBaseline(streakBefore);
  const editingLocked = Boolean(draft.submission) || sending || evaluating;
  const key = KEYS[step] ?? 'idea';
  const current = recall[key];
  const endPage = /^\d+$/.test(page.trim()) ? Number(page.trim()) : null;
  const allStamped = KEYS.every((item) => stamped.has(item));
  const nextOpen = KEYS.findIndex((item, index) => index > step && !stamped.has(item));
  const firstOpen = KEYS.findIndex((item) => !stamped.has(item));
  const peek = useAmbientLoop(3200, !typing);
  const bubbleRight = theme.spacing.xl + 104 + theme.spacing.xs;
  const bubbleWidth = Math.min(210, width - theme.sizes.gutter * 2 - bubbleRight);

  function persistDraft(next: Partial<Pick<SessionDraft, 'page' | 'recall'>>) {
    void persist({ ...draft, page, recall, ...next }).catch(() =>
      setLocalError('Não foi possível guardar o rascunho neste aparelho.'),
    );
  }

  function updateRecall(value: string) {
    if (checking.current || submitting.current || draft.submission) return;
    const next = { ...recall, [key]: value.slice(0, SESSION_RECALL_FIELD_MAX_LENGTH) };
    setRecall(next);
    setStamped((previous) => {
      if (!previous.has(key)) return previous;
      const copy = new Set(previous);
      copy.delete(key);
      return copy;
    });
    setNudge(null);
    setAssessment(null);
    setLocalError(null);
    check.reset();
    save.reset();
    persistDraft({ recall: next });
  }

  function goTo(index: number) {
    if (index < 0 || index >= KEYS.length || index === step) return;
    haptics.selection();
    setNudge(null);
    setLines(MIN_LINES);
    setStep(index);
  }

  function stamp() {
    if (editingLocked || current.trim() === '') return;
    const result = localCheck(recall, key);
    if (result !== 'ok') {
      haptics.warning();
      setNudge(result === 'repeat' ? REPEAT_NUDGE : STEPS[key].nudge);
      return;
    }
    haptics.success();
    setNudge(null);
    setStamped((previous) => new Set([...previous, key]));
  }

  async function submit(endPageNumber: number, note: CoachNote) {
    if (submitting.current) return;
    submitting.current = true;
    setSending(true);
    try {
      const submission = draft.submission ?? {
        id: draft.id,
        shelfEntryId: entry.id,
        startedAt: new Date(draft.startedAt ?? 0).toISOString(),
        endedAt: new Date(draft.endedAt ?? 0).toISOString(),
        focusedSeconds: Math.floor(draft.accumulatedMs / 1000),
        endPage: endPageNumber,
        reflection: null,
        recall,
        localDate: toLocalIsoDate(new Date(draft.endedAt ?? 0)),
      };
      await persist({ ...draft, page, recall, submission });
      const result = await save.mutateAsync(submission);
      let cleanupWarning: string | undefined;
      try {
        await clearSessionDraft(userId, draft.id);
      } catch {
        cleanupWarning =
          'A sessão foi salva, mas não foi possível apagar o rascunho deste aparelho. Se ele reaparecer, confirme o mesmo envio: não contará duas vezes.';
      }
      haptics.success();
      onSaved({
        result,
        cleanupWarning,
        coach: note,
        streakGrew: baseline !== null && result.stats.streakDays > baseline,
      });
    } catch (error) {
      haptics.error();
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
        setAssessment(null);
        setStamped(new Set());
        await persist({ ...draft, page, recall, submission: null }).catch(() => undefined);
        setLocalError('Confira a página e as três respostas antes de tentar concluir novamente.');
      } else {
        setLocalError('Não foi possível concluir. O registro foi mantido para tentar novamente.');
      }
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  /** The deliberate check (server checklist + optional coach), then the save when it passes. */
  async function finish() {
    if (checking.current || submitting.current) return;
    if (draft.submission) {
      await submit(draft.submission.endPage, { question: null, unavailable: false });
      return;
    }
    const checked = validateEndPage(page, entry.currentPage, total);
    if (checked.page === null) {
      haptics.warning();
      setPageError(checked.error);
      setPageSheet(true);
      return;
    }
    checking.current = true;
    setEvaluating(true);
    setAssessment(null);
    setLocalError(null);
    let response: AssessSessionResponse | null = null;
    try {
      await persist({ ...draft, page, recall });
      response = await check.mutateAsync({ shelfEntryId: entry.id, recall, coach });
    } catch (error) {
      haptics.error();
      setLocalError(
        error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT')
          ? 'Sem conexão. Sua lembrança fica guardada; tente de novo quando voltar.'
          : 'Não foi possível conferir agora. Seu rascunho continua aqui.',
      );
    } finally {
      checking.current = false;
      setEvaluating(false);
    }
    if (!response) return;
    const verdict = response;
    setAssessment(verdict);
    if (!verdict.assessment.passed) {
      haptics.warning();
      const failing = KEYS.filter((item) =>
        verdict.assessment.checks.some((c) => c.key === item && !c.passed),
      );
      const repeated = KEYS.findIndex(
        (item, index) =>
          index > 0 &&
          KEYS.slice(0, index).some((o) => recallAnswersRepeat(recall[item], recall[o])),
      );
      const reopen =
        failing.length > 0
          ? KEYS.indexOf(failing[0] ?? 'idea')
          : repeated === -1
            ? KEYS.length - 1
            : repeated;
      setStamped((previous) => {
        const copy = new Set(previous);
        for (const item of failing) copy.delete(item);
        const reopened = KEYS[reopen];
        if (reopened) copy.delete(reopened);
        return copy;
      });
      setStep(reopen);
      return;
    }
    await submit(checked.page, {
      question: verdict.coach.question,
      unavailable: verdict.coach.status === 'unavailable',
    });
  }

  const errorMessage =
    save.error instanceof ApiError &&
    (save.error.code === 'NETWORK_ERROR' || save.error.code === 'TIMEOUT')
      ? 'Sem conexão. Sua sessão continua aqui — tente salvar de novo.'
      : 'Não foi possível salvar a sessão. Tente de novo.';

  const checks = [
    { label: 'Suas palavras', passed: isSubstantialRecallAnswer(current) },
    { label: 'Algo concreto', passed: mentionsSomethingConcrete(current) },
    {
      label: 'Sem repetir',
      passed: current.trim() !== '' && localCheck(recall, key) !== 'repeat',
    },
  ];

  const primary = draft.submission
    ? { label: 'Confirmar envio', a11y: 'Confirmar envio guardado', onPress: () => void finish() }
    : allStamped
      ? {
          label: 'Ver meu recibo de leitura',
          a11y: 'Conferir e salvar a leitura',
          onPress: () => void finish(),
        }
      : stamped.has(key)
        ? {
            label: 'Próxima pergunta',
            a11y: 'Ir para a próxima pergunta',
            onPress: () => goTo(nextOpen === -1 ? firstOpen : nextOpen),
          }
        : {
            label: 'Guardar na memória',
            a11y: 'Guardar esta resposta',
            onPress: stamp,
          };

  return (
    <FormScreen
      leading="close"
      title="Lembrar sem espiar"
      headerRight={
        <Text variant="label" color="accentText" accessibilityLabel={`Pergunta ${step + 1} de 3`}>
          {step + 1}/3
        </Text>
      }
      footer={
        <View style={{ gap: theme.spacing.xs }}>
          {!draft.submission && !stamped.has(key) && current.trim() === '' ? (
            <LinkButton
              label="Me dá um começo"
              onPress={() => {
                if (!editingLocked) updateRecall(STEPS[key].starter);
              }}
            />
          ) : null}
          <Button
            label={primary.label}
            accessibilityLabel={primary.a11y}
            loading={sending || evaluating}
            disabled={
              (!draft.submission && !allStamped && !stamped.has(key) && current.trim() === '') ||
              sending ||
              evaluating
            }
            accessibilityHint={
              !draft.submission && !stamped.has(key) && current.trim() === ''
                ? 'Escreva sua resposta primeiro'
                : undefined
            }
            onPress={primary.onPress}
          />
        </View>
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Páginas ${entry.currentPage} a ${endPage ?? '?'}, ${formatDuration(draft.accumulatedMs / 1000)} de foco. Alterar página`}
        disabled={editingLocked}
        onPress={() => {
          setPageError(null);
          setPageSheet(true);
        }}
        style={({ pressed }) => ({
          alignSelf: 'center',
          minHeight: theme.sizes.touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.surface,
          borderWidth: 1.5,
          borderColor: theme.colors.borderSoft,
          opacity: pressed ? 0.75 : 1,
          marginTop: -theme.spacing.xs,
        })}
      >
        <Icon name="bookmark" size={16} color="accentText" />
        <Text variant="label" color="text">
          Págs. {entry.currentPage} → {endPage ?? '?'} ·{' '}
          {formatDuration(draft.accumulatedMs / 1000)} de foco
        </Text>
        {editingLocked ? null : <Icon name="edit" size={16} color="textMuted" />}
      </Pressable>

      {draft.reflection ? (
        <Card style={{ gap: theme.spacing.xs }}>
          <Text variant="titleSm">Sua anotação anterior</Text>
          <Text variant="bodySm">{draft.reflection}</Text>
          <Text variant="bodySm" color="textMuted">
            Organize sua anotação nas três perguntas.
          </Text>
        </Card>
      ) : null}

      <View style={{ paddingTop: 70 }}>
        <Animated.View
          style={{
            position: 'absolute',
            right: theme.spacing.xl - theme.spacing.xxs,
            top: 6,
            transform: [
              { translateY: peek.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
              {
                rotate: peek.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '2deg'] }),
              },
            ],
          }}
        >
          <BuboMascot pose={stamped.has(key) ? 'confident' : STEPS[key].pose} size={104} />
        </Animated.View>
        {nudge ? (
          <FadeIn
            style={{
              position: 'absolute',
              right: bubbleRight,
              top: 4,
              zIndex: 2,
              maxWidth: Math.max(140, bubbleWidth),
            }}
          >
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                backgroundColor: readingPalette.bubble,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 4,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
              }}
            >
              <Text variant="label" style={{ color: readingPalette.onBubble, lineHeight: 18 }}>
                {nudge}
              </Text>
            </View>
          </FadeIn>
        ) : null}

        <View
          accessibilityRole="tablist"
          accessibilityLabel="Partes da lembrança"
          style={{ flexDirection: 'row', gap: theme.spacing.xs, zIndex: 1 }}
        >
          {KEYS.map((item, index) => {
            const selected = index === step;
            const done = stamped.has(item);
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityLabel={`${STEPS[item].label}${done ? ', guardada' : ''}`}
                accessibilityState={{ selected }}
                hitSlop={{ top: 4, bottom: 0, left: 0, right: 0 }}
                onPress={() => goTo(index)}
                style={{
                  height: 44,
                  marginBottom: selected ? -2 : 0,
                  paddingHorizontal: theme.spacing.md + 2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  borderTopLeftRadius: 14,
                  borderTopRightRadius: 14,
                  borderWidth: 2,
                  borderBottomWidth: 0,
                  borderColor: readingPalette.paperBorder,
                  backgroundColor: selected
                    ? readingPalette.paper
                    : done
                      ? readingPalette.tabDone
                      : readingPalette.tabAhead,
                }}
              >
                {done ? <Icon name="check" size={16} tint={readingPalette.tabCheck} /> : null}
                <Text
                  variant="label"
                  style={{
                    fontSize: 13,
                    color: selected
                      ? readingPalette.paperInk
                      : done
                        ? readingPalette.tabDoneInk
                        : readingPalette.paperMuted,
                  }}
                >
                  {STEPS[item].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingBottom: 6 }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 6,
              bottom: 0,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              backgroundColor: readingPalette.paperRim,
            }}
          />
          <FadeIn
            key={step}
            style={{
              backgroundColor: readingPalette.paper,
              borderWidth: 2,
              borderColor: readingPalette.paperBorder,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              overflow: 'hidden',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 38,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: readingPalette.paperMargin,
              }}
            />
            <Text
              variant="titleSm"
              style={{
                paddingTop: 18,
                paddingRight: 18,
                paddingBottom: 12,
                paddingLeft: MARGIN,
                fontSize: 18,
                lineHeight: 25,
                color: readingPalette.paperInk,
              }}
            >
              {prompt(key, entry.currentPage, endPage)}
            </Text>
            <View style={{ height: lines * LINE + theme.spacing.lg }}>
              {Array.from({ length: lines }, (_, index) => (
                <View
                  key={index}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: LINE - 1 + index * LINE,
                    height: 1,
                    backgroundColor: readingPalette.paperLine,
                  }}
                />
              ))}
              <TextInput
                value={current}
                onChangeText={updateRecall}
                editable={!editingLocked}
                multiline
                scrollEnabled={false}
                maxLength={SESSION_RECALL_FIELD_MAX_LENGTH}
                placeholder="Escreva com suas palavras…"
                placeholderTextColor={readingPalette.paperMuted}
                accessibilityLabel={`${prompt(key, entry.currentPage, endPage)} Sua resposta, sem consultar o livro`}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                onContentSizeChange={(event) =>
                  setLines(
                    Math.max(MIN_LINES, Math.ceil(event.nativeEvent.contentSize.height / LINE) + 1),
                  )
                }
                textAlignVertical="top"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: MARGIN,
                  paddingRight: theme.spacing.lg,
                  fontFamily: accentFontFamily.hand,
                  fontSize: 24,
                  lineHeight: LINE,
                  color: readingPalette.handInk,
                }}
              />
            </View>
            {stamped.has(key) ? <Stamp /> : null}
          </FadeIn>
        </View>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="caption" color="accentDeep">
          O Bubo confere
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {checks.map((item) => (
            <View
              key={item.label}
              accessible
              accessibilityLabel={`${item.label}: ${item.passed ? 'sim' : 'ainda não'}`}
              style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xs }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: theme.radii.pill,
                  borderWidth: 2.5,
                  borderColor: item.passed ? theme.colors.primary : theme.colors.secondaryRim,
                  backgroundColor: item.passed ? theme.colors.primary : theme.colors.transparent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon
                  name={item.passed ? 'check' : 'add'}
                  size={22}
                  color={item.passed ? 'onPrimary' : 'textMuted'}
                />
              </View>
              <Text
                variant="labelSm"
                align="center"
                color={item.passed ? 'accentText' : 'textMuted'}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodySm" color="textMuted" align="center">
          Confere a escrita, não a retenção nem os fatos do livro.
        </Text>
      </View>

      {save.isError ? <InlineMessage tone="error" message={errorMessage} /> : null}
      {localError ? <InlineMessage tone="error" message={localError} /> : null}
      {draft.submission ? (
        <InlineMessage
          tone="info"
          message="Envio guardado. Tente novamente para confirmar a sessão."
        />
      ) : null}
      {assessment && !assessment.assessment.passed ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="titleSm" accessibilityRole="header">
            Vamos completar?
          </Text>
          <Text accessibilityLiveRegion="polite">{assessment.assessment.feedback}</Text>
          {assessment.assessment.checks.map((item) => (
            <InlineMessage
              key={item.key}
              tone={item.passed ? 'success' : 'info'}
              message={item.message}
            />
          ))}
        </Card>
      ) : null}
      {!draft.submission && (step === KEYS.length - 1 || allStamped) ? (
        <Card>
          <Toggle
            title="Pergunta extra com IA"
            description="Opcional: envia somente estas respostas ao Gemini. Conforme o serviço configurado, o provedor pode usar o texto para melhorar seus modelos. Evite informações pessoais ou sensíveis."
            value={coach}
            onValueChange={
              sending || evaluating
                ? undefined
                : (value) => {
                    if (!checking.current && !submitting.current) setCoach(value);
                  }
            }
          />
        </Card>
      ) : null}
      <LinkButton
        label="Descartar registro local"
        color="textMuted"
        onPress={() => {
          if (!checking.current && !submitting.current) onDiscard();
        }}
      />

      <PageSheet
        visible={pageSheet}
        tone="day"
        startPage={entry.currentPage}
        totalPages={total}
        initialValue={page}
        confirmLabel="Usar esta página"
        busy={false}
        error={pageError}
        onClose={() => setPageSheet(false)}
        onConfirm={(value) => {
          const next = String(value);
          setPage(next);
          setPageError(null);
          setPageSheet(false);
          setAssessment(null);
          save.reset();
          persistDraft({ page: next });
        }}
      />
    </FormScreen>
  );
}

/** The purple "Guardado" stamp, pressed onto the card with a short spring. */
function Stamp() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const press = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      press.setValue(1);
      return;
    }
    const animation = Animated.spring(press, {
      toValue: 1,
      damping: 11,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [press, reduced]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        right: 18,
        bottom: 16,
        paddingVertical: theme.spacing.xs + 2,
        paddingHorizontal: theme.spacing.md,
        borderWidth: 3,
        borderRadius: 10,
        borderColor: readingPalette.stamp,
        backgroundColor: readingPalette.stampWash,
        opacity: press.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.95, 0.9] }),
        transform: [
          { rotate: '-14deg' },
          { scale: press.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) },
        ],
      }}
    >
      <Text
        variant="labelLg"
        style={{ color: readingPalette.stamp, fontSize: 18, letterSpacing: 2.2 }}
      >
        GUARDADO
      </Text>
    </Animated.View>
  );
}
