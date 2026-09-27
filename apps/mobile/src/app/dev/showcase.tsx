import { Redirect } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { buboMascots, mascotLabels, type MascotPose } from '../../assets/registry';
import {
  BuboLogo,
  BuboMascot,
  Button,
  Card,
  Chip,
  ProgressBar,
  SectionHeader,
  Text,
  WeekStrip,
} from '../../design-system';
import { useApiHealth } from '../../lib/api/queries';
import { type ColorTokens, type TypographyVariant, typography, useTheme } from '../../theme';

/**
 * DEV-only design-system showcase. Everything here is sample UI for visual QA — it is never
 * reachable in production builds (redirects to Hoje) and never feeds real screens.
 */
const SWATCHES: (keyof ColorTokens)[] = [
  'primary',
  'primaryPressed',
  'purpleLight',
  'bg',
  'surface',
  'surfaceMuted',
  'text',
  'textMuted',
  'border',
  'success',
  'warning',
  'error',
  'gold',
  'orange',
];

const SAMPLE_WEEK = [
  { isoDate: 'd1', label: 'SEG', state: 'done' },
  { isoDate: 'd2', label: 'TER', state: 'done' },
  { isoDate: 'd3', label: 'QUA', state: 'missed' },
  { isoDate: 'd4', label: 'QUI', state: 'done' },
  { isoDate: 'd5', label: 'SEX', state: 'today' },
  { isoDate: 'd6', label: 'SÁB', state: 'future' },
  { isoDate: 'd7', label: 'DOM', state: 'future' },
] as const;

function ApiStatus() {
  const health = useApiHealth();
  const label = health.isPending
    ? 'Verificando API…'
    : health.isError
      ? `API indisponível (${health.error instanceof Error ? health.error.message : 'erro'})`
      : `API ok · ${health.data.service} ${health.data.version} · ${health.data.environment}`;
  return (
    <Chip
      label={label}
      tone={health.isError ? 'orange' : health.isSuccess ? 'success' : 'neutral'}
      icon={health.isError ? 'cloud-off' : 'cloud-done'}
    />
  );
}

export default function ShowcaseScreen() {
  const theme = useTheme();
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.bg }}
      contentContainerStyle={{
        padding: theme.sizes.gutter,
        gap: theme.spacing.lg,
        paddingBottom: theme.spacing.xxxl,
      }}
    >
      <Card>
        <SectionHeader title="Sistema" icon="dns" />
        <ApiStatus />
      </Card>

      <Card>
        <SectionHeader title="Marca" icon="verified" />
        <BuboLogo height={40} />
        <BuboLogo variant="symbol" height={56} />
      </Card>

      <Card>
        <SectionHeader title="Cores" icon="palette" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {SWATCHES.map((token) => (
            <View key={token} style={{ width: 96, gap: theme.spacing.xxs }}>
              <View
                style={{
                  height: 40,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors[token],
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              />
              <Text variant="bodySm" color="textMuted">
                {token}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Tipografia" icon="text-fields" />
        {(Object.keys(typography) as TypographyVariant[]).map((variant) => (
          <Text key={variant} variant={variant}>
            {variant} · Leia com profundidade
          </Text>
        ))}
      </Card>

      <Card>
        <SectionHeader title="Botões" icon="smart-button" />
        <Button label="Continuar leitura" icon="play-arrow" fullWidth />
        <Button
          label="Revisar agora"
          variant="success"
          fullWidth
          trailing={<Chip label="+25 XP" tone="gold" />}
        />
        <Button label="Atualizar" variant="secondary" size="md" icon="add" />
        <Button label="Carregando" loading fullWidth />
        <Button label="Desabilitado" disabled fullWidth />
      </Card>

      <Card>
        <SectionHeader
          title="Chips, progresso e semana (amostra)"
          icon="tune"
          trailing={<Chip label="+20 XP" tone="gold" />}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip label="Lendo agora" eyebrow />
          <Chip label="7" tone="orange" icon="local-fire-department" iconColor="orange" />
          <Chip label="340" tone="gold" icon="star" iconColor="goldRim" />
          <Chip label="3 cards pendentes" tone="neutral" icon="style" />
        </View>
        <ProgressBar percent={41} accessibilityLabel="Progresso de amostra: 41%" />
        <WeekStrip days={[...SAMPLE_WEEK]} />
      </Card>

      <Card>
        <SectionHeader title="Mascote oficial (todas as poses)" icon="pets" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {(Object.keys(buboMascots) as MascotPose[]).map((pose) => (
            <View key={pose} style={{ width: 96, alignItems: 'center', gap: theme.spacing.xxs }}>
              <BuboMascot pose={pose} size={88} decorative={false} />
              <Text variant="bodySm" color="textMuted" align="center" numberOfLines={2}>
                {pose}
              </Text>
              <Text
                variant="caption"
                color="textMuted"
                align="center"
                numberOfLines={2}
                style={{ textTransform: 'none' }}
              >
                {mascotLabels[pose]}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
