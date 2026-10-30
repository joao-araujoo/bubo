import { Linking, View } from 'react-native';

import { ActionRow, Card, FormScreen, Text } from '../../design-system';
import { publicConfig } from '../../lib/config';
import { useTheme } from '../../theme';
import { type LegalDoc } from './content';

/** Public contact for legal requests; honest fallback while the owner has not configured one. */
export function SupportContact() {
  const email = publicConfig.supportEmail;
  if (!email)
    return (
      <Text variant="bodySm" color="textMuted">
        Contato: use o canal indicado na página do Bubo na loja de aplicativos.
      </Text>
    );
  return (
    <ActionRow
      icon="alternate-email"
      title="Fale conosco"
      subtitle={email}
      accessibilityHint="Abre seu aplicativo de e-mail"
      onPress={() => void Linking.openURL(`mailto:${email}`).catch(() => undefined)}
    />
  );
}

/** Readable legal text: one card per section, reachable signed in or out (ADR-039). */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const theme = useTheme();
  return (
    <FormScreen title={doc.title}>
      <Text variant="bodySm" color="textMuted">
        {`Atualizado em ${doc.updatedAt}`}
      </Text>
      <Text variant="body">{doc.intro}</Text>
      {doc.sections.map((section) => (
        <Card key={section.heading} style={{ gap: theme.spacing.sm }}>
          <Text variant="titleSm" accessibilityRole="header">
            {section.heading}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} variant="body" color="textMuted">
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              <Text variant="body" color="accentText">
                •
              </Text>
              <Text variant="body" color="textMuted" style={{ flex: 1 }}>
                {bullet}
              </Text>
            </View>
          ))}
        </Card>
      ))}
      <SupportContact />
    </FormScreen>
  );
}
