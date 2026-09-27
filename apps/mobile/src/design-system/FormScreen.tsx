import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeIn } from '../lib/motion';
import { BuboLogo } from './BuboLogo';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { OfflineBanner } from './OfflineBanner';
import { ProgressBar } from './ProgressBar';
import { Raised } from './Raised';
import { Text } from './Text';

type Props = {
  children: ReactNode;
  /** Sticky bottom actions (primary CTA). */
  footer?: ReactNode;
  /** Shows a back button when navigation history exists. */
  back?: boolean;
  /** Onboarding progress, e.g. { current: 2, total: 6 }. */
  step?: { current: number; total: number };
  /** Centered header title with an optional eyebrow above it (Stitch "Adicionar manualmente"). */
  title?: string;
  eyebrow?: string;
  /** Round action on the right of the header. */
  headerRight?: ReactNode;
  brand?: boolean;
};

/** Round, raised header button (back, reset, settings). */
export function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}>
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.borderSoft}
          rimColor={theme.colors.cardShadow}
          radius={theme.radii.pill}
          depth={3}
          pressed={pressed}
          faceStyle={{
            width: theme.sizes.touchTarget,
            height: theme.sizes.touchTarget - 3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={22} />
        </Raised>
      )}
    </Pressable>
  );
}

/** Keyboard-safe screen for forms and onboarding: header (back + step), scroll body, sticky footer. */
export function FormScreen({
  children,
  footer,
  back = true,
  step,
  title,
  eyebrow,
  headerRight,
  brand = false,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showBack = back && router.canGoBack();
  const slot = { width: theme.sizes.touchTarget };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View
        style={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: title ? theme.spacing.sm : 0,
          paddingHorizontal: theme.sizes.gutter,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.sizes.touchTarget,
          gap: theme.spacing.md,
          borderBottomWidth: title ? 1 : 0,
          borderBottomColor: theme.colors.borderSoft,
        }}
      >
        <View style={slot}>
          {showBack ? (
            <HeaderButton icon="arrow-back" label="Voltar" onPress={() => router.back()} />
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {brand ? <BuboLogo height={32} /> : null}
          {step ? (
            <View
              style={{
                flexDirection: 'row',
                alignSelf: 'stretch',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <ProgressBar
                  percent={(step.current / step.total) * 100}
                  fromPercent={((step.current - 1) / step.total) * 100}
                  accessibilityLabel={`Progresso do cadastro: etapa ${step.current} de ${step.total}`}
                />
              </View>
              <Text variant="label" color="accentText">
                {step.current} de {step.total}
              </Text>
            </View>
          ) : null}
          {eyebrow ? (
            <Text variant="caption" color="accentText" align="center">
              {eyebrow}
            </Text>
          ) : null}
          {title ? (
            <Text variant="titleSm" accessibilityRole="header" align="center" numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        <View style={slot}>{headerRight}</View>
      </View>
      <OfflineBanner />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.sizes.gutter,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <FadeIn style={{ gap: theme.spacing.lg }}>{children}</FadeIn>
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: theme.sizes.gutter,
            paddingTop: theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing.md,
            gap: theme.spacing.sm,
            borderTopWidth: theme.sizes.borderWidth,
            borderTopColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.bg,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
