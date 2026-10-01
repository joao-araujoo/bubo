import { type ClubDetail, type ClubSummary } from '@bubo/contracts';
import { REPORTS_TO_HIDE } from '@bubo/domain';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Avatar,
  BuboTip,
  Card,
  GradientCard,
  Icon,
  Pill,
  type PillTone,
  SectionTitle,
  Text,
} from '../../../design-system';
import { haptics } from '../../../lib/haptics';
import { useTheme } from '../../../theme';

const RULES: {
  title: string;
  badge: string;
  badgeTone: PillTone;
  body: string;
  good?: string;
  bad?: string;
}[] = [
  {
    title: 'Ancore sempre capítulo e página',
    badge: 'Inviolável',
    badgeTone: 'primary',
    body: 'Ao criar debates, respostas ou enquetes, declare a página de que você fala. É isso que cobre o conteúdo para quem ainda não chegou lá.',
    good: 'Pág. 310 · O que acham da profecia das Bene Gesserit?',
    bad: 'Não acredito que o personagem morreu no final!',
  },
  {
    title: 'Debata ideias, nunca o colega',
    badge: 'Foco cognitivo',
    badgeTone: 'success',
    body: 'Divergências de interpretação enriquecem a memória. Use argumentos da obra. Ataques pessoais são removidos pelo criador do clube.',
  },
  {
    title: 'Citações claras e trechos breves',
    badge: 'Direito autoral',
    badgeTone: 'neutral',
    body: 'Compartilhe passagens curtas para comentar. Não poste capítulos inteiros.',
  },
  {
    title: 'Denuncie, não revide',
    badge: 'Denúncia consciente',
    badgeTone: 'warning',
    body: 'Viu spoiler sem página, ofensa ou spam? Use “Denunciar”. Se alguém incomoda, “Bloquear autor” faz a pessoa sumir para você em todos os clubes.',
  },
];

const FAQ = [
  {
    q: 'O que acontece quando eu denuncio?',
    a: `O conteúdo some para você na hora. Com ${REPORTS_TO_HIDE} denúncias de pessoas diferentes, ele fica oculto para todos até o criador do clube remover ou restaurar.`,
  },
  {
    q: 'Quem vê a minha página no livro?',
    a: 'Só os membros deste clube, na aba Membros. A página vem da sua estante e define o que fica coberto para você.',
  },
  {
    q: 'E se eu quiser ver um debate à frente?',
    a: 'Toque em “Revelar”. É sempre uma escolha sua; o Bubo nunca mostra spoilers sem você pedir.',
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={q}
      onPress={() => {
        haptics.selection();
        setOpen(!open);
      }}
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        minHeight: theme.sizes.touchTarget,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="bodyStrong" style={{ flex: 1, fontSize: 14 }}>
          {q}
        </Text>
        <Icon name={open ? 'expand-less' : 'expand-more'} size={22} color="textMuted" />
      </View>
      {open ? (
        <Text variant="bodySm" color="textMuted">
          {a}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Stitch "Diretrizes & Blindagem": honour code, the reader's shield, rules, guardians, FAQ. */
export function GuidelinesTab({
  club,
  ownerName,
}: {
  /** An invite preview has no reader page or join date yet. */
  club: ClubSummary & Partial<Pick<ClubDetail, 'readerPage' | 'joinedAt'>>;
  ownerName: string;
}) {
  const theme = useTheme();
  const page = club.readerPage ?? null;
  const total = club.book.totalPages;
  const joined = club.joinedAt ? new Date(club.joinedAt).toLocaleDateString('pt-BR') : null;
  return (
    <>
      <BuboTip
        state="profile"
        title="Código de honra do Bubo"
        titleIcon="verified-user"
        caps={false}
      >
        “No Bubo, ler em grupo é exercitar a empatia. A surpresa de um colega é sagrada!”
      </BuboTip>

      {page !== null ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="visibility-off" size={18} color="accentText" />
            <Text variant="label" style={{ flex: 1 }}>
              Sua blindagem automática
            </Text>
            <Pill tone="successSolid" caps label="Ativa 100%" />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            <View
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="caption" color="accentText">
                p.
              </Text>
              <Text variant="title" color="accentText">
                {page}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" numberOfLines={2}>
                {`${club.name} • ${club.book.title}`}
              </Text>
              <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
                {total && page < total
                  ? `Tudo entre as págs. ${page + 1} e ${total} recebe véu protetor até você registrar a leitura.`
                  : 'Você chegou ao fim do livro: nenhum debate fica coberto para você.'}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <SectionTitle
        icon="gavel"
        title="Regras da comunidade"
        trailing={
          <Text variant="bodySm" color="accentText" style={{ fontSize: 12 }}>
            4 mandamentos
          </Text>
        }
      />
      {RULES.map((rule, index) => (
        <Card key={rule.title}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: theme.radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: index === 3 ? theme.colors.goldSoft : theme.colors.primarySoft,
              }}
            >
              <Text variant="label" color={index === 3 ? 'warningText' : 'accentText'}>
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                }}
              >
                <Text variant="bodyStrong" accessibilityRole="header">
                  {rule.title}
                </Text>
                <Pill tone={rule.badgeTone} label={rule.badge} />
              </View>
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
                  gap: 2,
                  padding: theme.spacing.sm,
                  borderRadius: theme.radii.md,
                  borderWidth: 1,
                  borderColor: theme.colors.success,
                  backgroundColor: theme.colors.successSoft,
                }}
              >
                <Text variant="label" color="successText" style={{ fontSize: 12 }}>
                  ✓ Correto:
                </Text>
                <Text variant="bodySm" color="successText" style={{ fontSize: 12 }}>
                  {`“${rule.good}”`}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  gap: 2,
                  padding: theme.spacing.sm,
                  borderRadius: theme.radii.md,
                  borderWidth: 1,
                  borderColor: theme.colors.error,
                  backgroundColor: theme.colors.errorSoft,
                }}
              >
                <Text variant="label" color="errorText" style={{ fontSize: 12 }}>
                  ✕ Incorreto:
                </Text>
                <Text variant="bodySm" color="errorText" style={{ fontSize: 12 }}>
                  {`“${rule.bad}”`}
                </Text>
              </View>
            </View>
          ) : null}
        </Card>
      ))}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="verified-user" size={20} color="accentText" />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            Guardiões da leitura
          </Text>
          <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
            1 moderador
          </Text>
        </View>
        <Text variant="bodySm" color="textMuted">
          Quem cuida do ritmo do clube, revisa denúncias e remove ou restaura conteúdos.
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Avatar name={ownerName} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
                {club.membership === 'owner' ? 'Você' : ownerName}
              </Text>
              <Pill caps tone="primarySolid" label="Criador" />
            </View>
            <Text variant="bodySm" color="textMuted" style={{ fontSize: 12 }}>
              Guardião fundador do clube
            </Text>
          </View>
        </View>
      </Card>

      <SectionTitle icon="help-outline" title="Dúvidas frequentes sobre moderação" />
      {FAQ.map((item) => (
        <Faq key={item.q} q={item.q} a={item.a} />
      ))}

      <GradientCard>
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Icon name="workspace-premium" size={18} color="gold" />
            <Text variant="caption" color="gold">
              Compromisso do leitor
            </Text>
          </View>
          <Text variant="bodySm" color="onPrimary">
            {club.membership
              ? 'Você aceitou estas diretrizes ao entrar no clube. Obrigado por proteger a leitura de todos.'
              : 'Ao entrar no clube, você aceita estas diretrizes e protege a leitura de todos.'}
          </Text>
          {joined ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="label" color="onHeroMuted" style={{ flex: 1, fontSize: 12 }}>
                {`Membro desde ${joined}`}
              </Text>
              <Icon name="check-circle-outline" size={16} color="success" />
              <Text variant="label" color="success" style={{ fontSize: 12, marginLeft: 4 }}>
                Em conformidade
              </Text>
            </View>
          ) : null}
        </View>
      </GradientCard>
    </>
  );
}
