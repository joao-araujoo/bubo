import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../../theme/tokens';

type Props = {
  title: string;
  description?: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
};

export function ChoiceTile({ title, description, icon, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <View style={styles.copy}>
        <Text style={[styles.title, selected && styles.selectedTitle]}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={[styles.check, selected && styles.checkSelected]}>
        <Text style={[styles.checkMark, selected && styles.checkMarkSelected]}>
          {selected ? '✓' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 72,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderBottomWidth: 4,
    borderBottomColor: colors.borderStrong,
    borderRadius: radii.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderBottomColor: colors.primaryPressed,
  },
  pressed: {
    transform: [{ translateY: 2 }],
    borderBottomWidth: 2,
  },
  icon: {
    width: 32,
    textAlign: 'center',
    fontSize: 24,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  selectedTitle: {
    color: colors.primaryPressed,
  },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkMark: {
    color: colors.surface,
    fontFamily: fonts.extraBold,
    fontSize: 13,
  },
  checkMarkSelected: {
    color: '#FFFFFF',
  },
});
