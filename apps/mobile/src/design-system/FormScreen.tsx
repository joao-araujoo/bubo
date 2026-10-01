import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
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
  /** Sticky bottom actions (primary CTA). */
  footer?: ReactNode;
  /** Shows a back button when navigation history exists. */
  back?: boolean;
  /** Onboarding progress, e.g. { current: 2, total: 6 }. */
  step?: { current: number; total: number };
  /** Centered header title with an optional eyebrow above it (Stitch "Adicionar manualmente"). */
  title?: string;
  eyebrow?: string;
  /** Actions on the right of the header (any width). */
  headerRight?: ReactNode;
  brand?: boolean;
  /** `left`: Stitch club screens (eyebrow + title aligned left, square buttons). */
  align?: 'center' | 'left';
  /** Green status dot after the eyebrow (Stitch "CLUBE DE LEITURA ●"). */
  eyebrowDot?: boolean;
  /** `close` shows ✕ (modal creation screens) instead of ←. */
  leading?: 'back' | 'close';
  /** Floating action pill anchored bottom-right (Stitch "Novo Tópico"). */
  floating?: ReactNode;
};

/** Raised header button (back, close, search, menu). `square` = Stitch club-screen squircle. */
export function HeaderButton({
  icon,
  label,
  onPress,
  shape = 'round',
  iconColor = 'text',
}: {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  shape?: 'round' | 'square';
  iconColor?: keyof ColorTokens;
}) {
  const theme = useTheme();
  const square = shape === 'square';
  const size = square ? 42 : theme.sizes.touchTarget;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={square ? 6 : 4}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={square ? theme.colors.border : theme.colors.borderSoft}
          rimColor={square ? theme.colors.secondaryRim : theme.colors.cardShadow}
          radius={square ? theme.radii.md : theme.radii.pill}
          depth={3}
          pressed={pressed}
          faceStyle={{
            width: size,
            height: size - 3,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={square ? 20 : 22} color={iconColor} />
        </Raised>
      )}
    </Pressable>
  );
}

/** Stitch eyebrow: tracked uppercase in deep purple, optional green status dot. */
export function Eyebrow({
  label,
  dot = false,
  align = 'left',
}: {
  label: string;
  dot?: boolean;
  align?: 'left' | 'center';
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: align === 'center' ? 'center' : 'flex-start',
        gap: theme.spacing.xs,
      }}
    >
      <Text variant="caption" color="accentDeep" numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      {dot ? (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.success,
          }}
        />
      ) : null}
    </View>
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
  align = 'center',
  eyebrowDot = false,
  leading = 'back',
  floating,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showBack = back && router.canGoBack();
  const slot = { width: theme.sizes.touchTarget };
  const left = align === 'left';

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
        <View style={left ? undefined : slot}>
          {showBack ? (
            <HeaderButton
              icon={leading === 'close' ? 'close' : 'arrow-back'}
              label={leading === 'close' ? 'Fechar' : 'Voltar'}
              shape={left ? 'square' : 'round'}
              onPress={() => router.back()}
            />
          ) : null}
        </View>
        <View style={{ flex: 1, alignItems: left ? 'flex-start' : 'center' }}>
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
            <Eyebrow label={eyebrow} dot={eyebrowDot} align={left ? 'left' : 'center'} />
          ) : null}
          {title ? (
            <Text
              variant="titleSm"
              accessibilityRole="header"
              align={left ? 'left' : 'center'}
              numberOfLines={left ? 2 : 1}
              style={left ? { fontSize: 19, lineHeight: 24 } : undefined}
            >
              {title}
            </Text>
          ) : null}
        </View>
        <View
          style={
            left || headerRight
              ? {
                  minWidth: left ? 0 : theme.sizes.touchTarget,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: theme.spacing.sm,
                }
              : slot
          }
        >
          {headerRight}
        </View>
      </View>
      <OfflineBanner />
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
