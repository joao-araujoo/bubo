import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BuboScreen } from '../../src/components/layout/BuboScreen';
import { OnboardingHeader } from '../../src/components/layout/OnboardingHeader';
import { BuboButton } from '../../src/components/ui/BuboButton';
import { BuboCard } from '../../src/components/ui/BuboCard';
import { BuboInput } from '../../src/components/ui/BuboInput';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { colors, fonts, spacing, typography } from '../../src/theme/tokens';
import { useState } from 'react';

const demo = [
  { id: 'dune', title: 'Duna', author: 'Frank Herbert', meta: '680 páginas • Ficção' },
  { id: 'estrangeiro', title: 'O Estrangeiro', author: 'Albert Camus', meta: '128 páginas • Clássico' },
];

export default function FirstBookScreen() {
  const [query, setQuery] = useState('');
  const { firstBookId, setFirstBook, skipFirstBook } = useOnboarding();

  return (
    <BuboScreen>
      <OnboardingHeader step={5} eyebrow="Início da Estante" />
      <Text style={styles.title}>O que você está lendo agora?</Text>
      <Text style={styles.subtitle}>
        Adicione seu primeiro livro para iniciar a leitura profunda e preparar seu primeiro recall.
      </Text>

      <View style={styles.search}>
        <BuboInput
          label="Buscar livro"
          value={query}
          onChangeText={setQuery}
          placeholder="Título, autor ou ISBN"
        />
      </View>

      <View style={styles.results}>
        {demo.map((book) => (
          <BuboCard
            key={book.id}
            style={[
              styles.book,
              firstBookId === book.id ? styles.bookSelected : {},
            ]}
          >
            <View style={styles.cover}><Text style={styles.coverText}>BUBO</Text></View>
            <View style={styles.bookCopy}>
              <Text style={styles.bookTitle}>{book.title}</Text>
              <Text style={styles.author}>{book.author}</Text>
              <Text style={styles.meta}>{book.meta}</Text>
            </View>
            <Text
              onPress={() => setFirstBook(book.id)}
              style={[styles.select, firstBookId === book.id && styles.selectActive]}
            >
              {firstBookId === book.id ? '✓' : '+'}
            </Text>
          </BuboCard>
        ))}
      </View>

      <View style={styles.quickRow}>
        <Text style={styles.quick}>▣ Escanear ISBN</Text>
        <Text style={styles.quick}>＋ Adicionar manual</Text>
      </View>

      <View style={styles.footer}>
        <BuboButton
          label={firstBookId === 'dune' ? 'Colocar Duna na Minha Estante' : firstBookId ? 'Adicionar à Minha Estante' : 'Selecione um livro'}
          disabled={!firstBookId}
          onPress={() => router.push('/(onboarding)/complete')}
        />
        <Text
          onPress={() => {
            skipFirstBook();
            router.push('/(onboarding)/complete');
          }}
          style={styles.skip}
        >
          Pular por enquanto (adicionar depois)
        </Text>
      </View>
    </BuboScreen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: 6 },
  search: { marginTop: spacing.xl },
  results: { gap: 10, marginTop: 14 },
  book: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 },
  bookSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cover: {
    width: 52, height: 72, borderRadius: 8, backgroundColor: colors.primaryPressed,
    alignItems: 'center', justifyContent: 'center',
  },
  coverText: { color: '#FFFFFF', fontFamily: fonts.extraBold, fontSize: 9, transform: [{ rotate: '-90deg' }] },
  bookCopy: { flex: 1, gap: 2 },
  bookTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  author: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 },
  meta: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11 },
  select: {
    width: 32, height: 32, borderRadius: 16, textAlign: 'center', textAlignVertical: 'center',
    lineHeight: 29, color: colors.primary, borderWidth: 2, borderColor: colors.primary,
    fontFamily: fonts.extraBold, fontSize: 18,
  },
  selectActive: { color: '#FFFFFF', backgroundColor: colors.primary },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 8 },
  quick: { color: colors.primaryPressed, fontFamily: fonts.bold, fontSize: 12, flex: 1, textAlign: 'center' },
  footer: { marginTop: spacing.xl, gap: 14 },
  skip: { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.bold, fontSize: 12 },
});
