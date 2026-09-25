import { SafeAreaView, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.page, gap: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{title}</Text>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 2,
            borderRadius: radii.card,
            padding: spacing.lg,
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
            Bubo 4 foundation. This screen will be implemented from the approved Stitch reference during its vertical slice.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
