import { type ClubDetail, type ClubSummary } from '@bubo/contracts';
import { readingProgress } from '@bubo/domain';
import { Pressable, View } from 'react-native';

import {
  BookCover,
  BuboTip,
  Card,
  GradientCard,
  Icon,
  Pill,
  ProgressBar,
  Raised,
  SectionTitle,
  StatTile,
  Text,
} from '../../../design-system';
import { haptics } from '../../../lib/haptics';
import { useTheme } from '../../../theme';
import { CLUB_ICON_META } from '../meta';

/** White tactile button on the purple hero (Stitch "Convidar amigos"). */
function HeroButton({
  label,
  icon,
  onPress,
  loading,
}: {
  label: string;
  icon: 'person-add' | 'group-add';
  onPress: () => void;
  loading?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={() => {
        haptics.press();
        onPress();
      }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.surface}
          rimColor={theme.colors.primarySoft}
          radius={theme.radii.lg}
          depth={4}
          pressed={pressed}
          faceStyle={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <Icon name={icon} size={20} color="accentText" />
          <Text variant="labelLg" color="accentText">
            {loading ? 'Entrando…' : label}
          </Text>
        </Raised>
      )}
    </Pressable>
  );
}

/**
 * Stitch "Perfil do clube": gradient hero, stats, the curator bubble with the reader's real page and
 * the club book. Non-members join from here (or from an invite preview, which has no detail
 * fields); members reach it from the club menu.
 */
export function ClubProfile({
  club,
  onJoin,
  joining,
  onInvite,
  onGuidelines,
  joinLabel = 'Entrar e aceitar as diretrizes',
}: {
  club: ClubSummary & Partial<Pick<ClubDetail, 'readerPage' | 'unlockedTopicCount'>>;
  joinLabel?: string;
  onJoin: () => void;
  joining: boolean;
  onInvite: () => void;
  onGuidelines: () => void;
}) {
  const theme = useTheme();
  const member = club.membership !== null;
  const owner = club.membership === 'owner';
  const page = club.readerPage ?? club.myPage ?? 0;
  const progress = readingProgress(page, club.book.totalPages ?? 0);

  const curator = member
    ? `Você está na pág. ${page} de ${club.book.title}. Desbloqueou ${club.unlockedTopicCount ?? 0} dos ${club.topicCount} debates deste clube!`
    : club.onMyShelf
      ? `Você está na pág. ${page} deste livro. Ao entrar, os debates se ajustam à sua página.`
      : 'Ao entrar, o livro vai para a sua estante como “Quero ler” e os debates se ajustam à sua página.';

  return (
    <>
      <GradientCard>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: theme.colors.purpleLight,
                backgroundColor: theme.colors.heroEnd,
              }}
            >
              <Icon name={CLUB_ICON_META[club.icon].icon} size={40} color="gold" />
            </View>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text
                variant="heading"
                color="onPrimary"
                numberOfLines={3}
                accessibilityRole="header"
              >
                {club.name}
              </Text>
              <Pill
                tone="gold"
                icon={club.visibility === 'private' ? 'lock-outline' : 'public'}
                label={club.visibility === 'private' ? 'Clube privado' : 'Clube público'}
              />
            </View>
          </View>
          {club.description ? (
            <Text variant="body" color="onHeroMuted">
              {club.description}
            </Text>
          ) : null}
          {member ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.md,
                borderRadius: theme.radii.lg,
                borderWidth: 1,
                borderColor: theme.colors.heroGlow,
                backgroundColor: theme.colors.heroGlowSoft,
              }}
            >
              <Icon name="verified-user" size={28} color="gold" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" color="onPrimary">
                  {owner ? 'Você é o Guardião Fundador' : 'Você é membro deste clube'}
                </Text>
                <Text variant="bodySm" color="onHeroMuted">
                  {owner ? 'Modera debates e revisa denúncias' : `Criado por ${club.ownerName}`}
                </Text>
              </View>
            </View>
          ) : null}
          {member ? (
            <HeroButton label="Convidar amigos" icon="person-add" onPress={onInvite} />
          ) : (
            <HeroButton label={joinLabel} icon="group-add" loading={joining} onPress={onJoin} />
          )}
        </View>
      </GradientCard>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile label="Membros" value={String(club.memberCount)} icon="group" />
        <StatTile label="Debates" value={String(club.topicCount)} icon="forum" tone="gold" />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <StatTile
          label="Meta semanal"
          value={club.weeklyGoalPages ? String(club.weeklyGoalPages) : 'Livre'}
          unit={club.weeklyGoalPages ? 'pág/sem' : undefined}
          icon="menu-book"
          tone="blue"
        />
        <StatTile
          label="Blindagem"
          value="100%"
          unit="anti"
          icon="shield"
          tone="success"
          valueColor="successText"
        />
      </View>

      <BuboTip pose="takingNotes" title="Bubo curador" titleIcon="psychology" tone="soft">
        {curator}
      </BuboTip>

      <SectionTitle icon="auto-stories" title="Obra do ciclo atual" />
      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <BookCover
            title={club.book.title}
            author={club.book.author}
            coverUrls={club.book.coverUrls}
            width={84}
          />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            {club.onMyShelf ? <Pill tone="success" dot label="Na sua estante" /> : null}
            <Text variant="titleSm" numberOfLines={3}>
              {club.book.title}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {[club.book.author, club.book.totalPages ? `${club.book.totalPages} páginas` : null]
                .filter(Boolean)
                .join(' • ')}
            </Text>
            {club.onMyShelf && progress.totalPages > 0 ? (
              <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="label" color="accentText" style={{ fontSize: 13 }}>
                    {`Pág. ${page}`}
                  </Text>
                  {club.weeklyGoalPages ? (
                    <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                      {`Meta: ${club.weeklyGoalPages} págs/sem`}
                    </Text>
                  ) : null}
                </View>
                <ProgressBar
                  percent={progress.percent}
                  size="sm"
                  accessibilityLabel={`Seu progresso no livro: ${progress.percent}%`}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ler as diretrizes do clube"
        onPress={onGuidelines}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touchTarget,
        }}
      >
        <Icon name="gavel" size={18} color="accentText" />
        <Text variant="label" color="accentText" style={{ flex: 1 }}>
          Ler as diretrizes e a blindagem do clube
        </Text>
        <Icon name="chevron-right" size={20} color="accentText" />
      </Pressable>
    </>
  );
}
