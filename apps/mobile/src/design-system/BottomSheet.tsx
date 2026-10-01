import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

/**
 * Stitch bottom sheet ("Ações do livro"): scrim, rounded white sheet with a grab handle, content
 * scrolls when long. Closing: tap the scrim, the Android back button or a control inside.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  accessibilityLabel,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.scrim,
          }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={{
            maxHeight: '88%',
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderWidth: theme.sizes.borderWidth,
            borderBottomWidth: 0,
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.surface,
            paddingBottom: insets.bottom + theme.spacing.lg,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 48,
              height: 5,
              marginTop: theme.spacing.md,
              marginBottom: theme.spacing.sm,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.purpleLight,
            }}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: theme.sizes.gutter + 4,
              paddingTop: theme.spacing.sm,
              gap: theme.spacing.md,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
