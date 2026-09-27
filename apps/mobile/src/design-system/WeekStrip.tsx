import { type WeekDay } from '@bubo/domain';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

const stateLabel: Record<WeekDay['state'], string> = {
  done: 'atividade concluída',
  today_done: 'hoje, atividade concluída',
  today: 'hoje, ainda sem atividade',
  missed: 'sem atividade',
  future: 'ainda não chegou',
};

/** Monday→Sunday strip for "Sua semana cognitiva". Renders only real activity. */
export function WeekStrip({ days }: { days: WeekDay[] }) {
  const theme = useTheme();
  const size = 40;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((day) => {
        const isToday = day.state === 'today' || day.state === 'today_done';
        const done = day.state === 'done' || day.state === 'today_done';
        return (
          <View
            key={day.isoDate}
            accessible
            accessibilityLabel={`${day.label}: ${stateLabel[day.state]}`}
            style={{ alignItems: 'center', gap: theme.spacing.xs }}
          >
            <Text variant="caption" color={isToday ? 'accentText' : 'textMuted'}>
              {day.label}
            </Text>
            <View
              style={{
                width: size,
                height: size,
                borderRadius: theme.radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: done
                  ? theme.colors.primary
                  : isToday
                    ? theme.colors.goldSoft
                    : theme.colors.surfaceMuted,
                borderWidth: theme.sizes.borderWidth,
                borderStyle: done || isToday ? 'solid' : 'dashed',
                borderColor: done
                  ? theme.colors.primaryRim
                  : isToday
                    ? theme.colors.gold
                    : theme.colors.border,
              }}
            >
              {done ? <Icon name="check" size={20} color="onPrimary" /> : null}
              {!done && isToday ? <Icon name="star-outline" size={20} color="goldRim" /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
