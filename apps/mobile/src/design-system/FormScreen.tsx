import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeIn } from '../lib/motion';
import { BuboLogo } from './BuboLogo';
import { type ColorTokens, useTheme } from '../theme';
import { Icon } from './Icon';
import { OfflineBanner } from './OfflineBanner';
import { ProgressBar } from './ProgressBar';
import { Raised } from './Raised';
import { Text } from './Text';

type Props = {
  children: ReactNode;
  /** Virtualized list bodies manage their own scrolling. */
  scroll?: boolean;
  /** Sticky bottom actions (primary CTA). */
  footer?: ReactNode;
  /** Shows a back button when navigation history exists. */
  back?: boolean;
  /** Onboarding progress, e.g. { current: 2, total: 6 }. */
  step?: { current: number; total: number };
  /** Screen title, left-aligned next to the back button (one header style for every stack screen). */
  title?: string;
  /** One line of real context under the title: the club, the book, the position in a queue. */
  subtitle?: string;
  /** Actions on the right of the header (HeaderButtons, at most two plus a status pill). */
  headerRight?: ReactNode;
  /** Centred logo for the signed-out and onboarding screens (no title). */
  brand?: boolean;
  /** `close` shows ✕ (modal creation screens) instead of ←. */
  leading?: 'back' | 'close';
  /** Floating action pill anchored bottom-right (e.g. "Novo tópico"). */
  floating?: ReactNode;
};

/** Raised round header button (back, close, search, menu), always a 48 pt touch target. */
export function HeaderButton({
  icon,
  label,
  onPress,
  iconColor = 'text',
  badge,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  iconColor?: keyof ColorTokens;
  /** Real count drawn on the corner (e.g. unread notifications); hidden when 0. */
  badge?: number;
}) {
  const theme = useTheme();
  const size = theme.sizes.touchTarget;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} ${badge === 1 ? 'nova' : 'novas'}` : label}
      onPress={onPress}
      hitSlop={4}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.borderSoft}
          rimColor={theme.colors.cardShadow}
          radius={theme.radii.pill}
          depth={3}
          pressed={pressed}
          faceStyle={{
            width: size,
            height: size - 3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={22} color={iconColor} />
          {badge ? (
            <View
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 20,
                height: 20,
                paddingHorizontal: 4,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.colors.surface,
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text
                variant="labelSm"
                color="onPrimary"
                style={{ fontSize: 10, lineHeight: 13, includeFontPadding: false }}
              >
                {badge > 99 ? '99+' : String(badge)}
              </Text>
            </View>
          ) : null}
        </Raised>
      )}
    </Pressable>
  );
}

/**
 * Keyboard-safe screen for every pushed or modal route: one header (back/close, left-aligned
 * title with optional context line, right actions), scroll body and sticky footer. Signed-out and
 * onboarding screens use the centred `brand` / `step` header instead of a title.
 */
export function FormScreen({
  children,
  footer,
  back = true,
  step,
  title,
  subtitle,
  headerRight,
  brand = false,
  leading = 'back',
  floating,
  scroll = true,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showBack = back && router.canGoBack();
  const titled = Boolean(title);
  const backButton = showBack ? (
    <HeaderButton
      icon={leading === 'close' ? 'close' : 'arrow-back'}
      label={leading === 'close' ? 'Fechar' : 'Voltar'}
      onPress={() => router.back()}
    />
  ) : null;

  return (
    <KeyboardAvoidingView
      // Android draws edge-to-edge (SDK 57), so the window no longer shrinks for the keyboard:
      // padding keeps fields and the sticky footer (composers, publish buttons) above it.
      behavior="padding"
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View
        style={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: titled ? theme.spacing.md : 0,
          paddingHorizontal: theme.sizes.gutter,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.sizes.touchTarget,
          gap: theme.spacing.md,
          borderBottomWidth: titled ? 1 : 0,
          borderBottomColor: theme.colors.borderSoft,
        }}
      >
        {titled ? (
          <>
            {backButton}
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <Text variant="title" accessibilityRole="header" numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="bodySm" color="textMuted" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {headerRight ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                {headerRight}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={{ width: theme.sizes.touchTarget }}>{backButton}</View>
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
            </View>
            <View
              style={{
                minWidth: theme.sizes.touchTarget,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: theme.spacing.sm,
              }}
            >
              {headerRight}
            </View>
          </>
        )}
      </View>
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.sizes.gutter,
            paddingTop: theme.spacing.lg,
            // Room for the floating action so it never covers the last card.
            paddingBottom: floating ? 104 : theme.spacing.xxl,
            gap: theme.spacing.lg,
          }}
        >
          <FadeIn style={{ gap: theme.spacing.lg }}>{children}</FadeIn>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {floating ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            right: theme.sizes.gutter,
            bottom: (footer ? 96 : insets.bottom) + theme.spacing.lg,
          }}
        >
          {floating}
        </View>
      ) : null}
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
