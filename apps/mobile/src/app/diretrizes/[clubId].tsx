import { REPORTS_TO_HIDE } from '@bubo/domain';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { BuboMascot, Card, FormScreen, SectionHeader, Text } from '../../design-system';
import { useClub } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { useTheme } from '../../theme';

const RULES = [
  {
    title: 'Ancore sempre a página',
    body: 'Todo debate e toda resposta dizem de que página falam. É isso que protege quem ainda não chegou lá.',
    good: 'Pág. 310 · O que vocês acham da profecia?',
    bad: 'Não acredito que o personagem morreu no final!',
  },
  {
    title: 'Debata ideias, nunca pessoas',
    body: 'Divergir enriquece a memória do livro. Ataques pessoais são removidos pelo criador do clube.',
  },
  {
    title: 'Citações curtas',
    body: 'Compartilhe trechos breves para comentar. Não copie capítulos inteiros: respeite o direito autoral.',
  },
  {
    title: 'Denuncie, não revide',
    body: 'Viu spoiler sem página, ofensa ou spam? Use “Denunciar”. Se alguém incomoda, “Bloquear autor” faz a pessoa sumir para você.',
  },
];

/** Stitch `bubo_diretrizes_modera_o_do_clube_mobile`, describing only moderation that exists. */
export default function GuidelinesScreen() {
  const theme = useTheme();
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const auth = useAuthState();
  const club = useClub(
    auth.status === 'ready' ? auth.userId : undefined,
    typeof clubId === 'string' ? clubId : '',
  );
  const readerPage = club.data?.readerPage;

  return (
    <FormScreen title="Diretrizes do clube" eyebrow={club.data?.name ?? 'Clube de leitura'}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot state="profile" size={72} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="caption" color="accentText">
              Código de honra do Bubo
            </Text>
            <Text variant="bodySm">
              Ler em grupo é exercitar a empatia. A surpresa de um colega é sagrada.
            </Text>
          </View>
        </View>
      </Card>

      {readerPage !== null && readerPage !== undefined ? (
        <Card>
          <SectionHeader title="Sua blindagem" icon="shield" />
          <Text variant="body">
            Você está na pág. {readerPage}
            {club.data?.book.totalPages ? ` de ${club.data.book.totalPages}` : ''}. Tudo o que fala
            de páginas depois dessa aparece como aviso até você atualizar seu progresso na Estante.
          </Text>
        </Card>
      ) : null}

      <SectionHeader title="Regras da comunidade" icon="gavel" />
      {RULES.map((rule, index) => (
        <Card key={rule.title}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: theme.radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="label" color="accentText">
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text variant="bodyStrong" accessibilityRole="header">
                {rule.title}
              </Text>
              <Text variant="bodySm" color="textMuted">
                {rule.body}
              </Text>
            </View>
          </View>
          {rule.good && rule.bad ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View
                style={{
                  flex: 1,
                  gap: theme.spacing.xxs,
                  padding: theme.spacing.sm,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Text variant="label" color="accentText">
                  Certo
                </Text>
                <Text variant="bodySm">“{rule.good}”</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  gap: theme.spacing.xxs,
                  padding: theme.spacing.sm,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.errorSoft,
                }}
              >
                <Text variant="label" color="error">
                  Errado
                </Text>
                <Text variant="bodySm">“{rule.bad}”</Text>
              </View>
            </View>
          ) : null}
        </Card>
      ))}

      <Card tone="muted">
        <SectionHeader title="Como funciona a moderação" icon="flag" />
        <Text variant="bodySm" color="textMuted">
          • Ao denunciar, o conteúdo some para você na hora.
        </Text>
        <Text variant="bodySm" color="textMuted">
          • Com {REPORTS_TO_HIDE} denúncias de pessoas diferentes, ele fica oculto para todos até o
          criador do clube revisar: remover ou restaurar.
        </Text>
        <Text variant="bodySm" color="textMuted">
          • Quem escreveu pode apagar o próprio conteúdo a qualquer momento.
        </Text>
        <Text variant="bodySm" color="textMuted">
          • Bloquear alguém esconde tudo o que essa pessoa escreve, em todos os clubes.
        </Text>
      </Card>
    </FormScreen>
  );
}
