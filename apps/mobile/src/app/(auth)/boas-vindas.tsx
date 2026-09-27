import { useRouter } from 'expo-router';
import { View } from 'react-native';

import {
  BuboLogo,
  BuboMascot,
  Button,
  Card,
  Chip,
  FormScreen,
  Icon,
  LinkButton,
  Text,
} from '../../design-system';
import { ONBOARDING_TOTAL_STEPS } from '../../features/onboarding/options';
import { useTheme } from '../../theme';

const PILLARS = [
  { icon: 'menu-book', title: 'Leitura', subtitle: 'Sem pressa' },
  { icon: 'psychology', title: 'Recall', subtitle: 'Sem espiar' },
  { icon: 'verified', title: 'Retenção', subtitle: 'Para sempre' },
] as const;

/** Onboarding 1/6 — Filosofia Bubo (before creating an account). */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <FormScreen
      back={false}
      step={{ current: 1, total: ONBOARDING_TOTAL_STEPS }}
      footer={
        <>
          <Button
            label="Começar"
            icon="arrow-forward"
            fullWidth
            onPress={() => router.push('/cadastro')}
          />
          <LinkButton label="Já tenho uma conta" onPress={() => router.push('/entrar')} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
        <BuboLogo height={32} />
        <BuboMascot animated state="onboarding" size={200} />
      </View>
      <View style={{ gap: theme.spacing.xs, alignItems: 'center' }}>
        <Chip label="Filosofia Bubo" eyebrow align="center" />
        <Text variant="display" align="center" accessibilityRole="header">
          Leia. Pense.{'\n'}
          <Text variant="display" color="accentText">
            Lembre.
          </Text>
        </Text>
        <Text variant="bodyLg" color="textMuted" align="center">
          O Bubo ajuda você a descobrir o que realmente ficou guardado depois que a última página é
          fechada.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {PILLARS.map((pillar) => (
          <Card
            key={pillar.title}
            containerStyle={{ flex: 1 }}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            }}
          >
            <Icon name={pillar.icon} size={28} color="accentText" />
            <Text variant="label" align="center">
              {pillar.title}
            </Text>
            <Text variant="bodySm" color="textMuted" align="center">
              {pillar.subtitle}
            </Text>
          </Card>
        ))}
      </View>
    </FormScreen>
  );
}
