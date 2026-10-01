import { cycleDaysLeft, cycleGroupPercent } from '@bubo/domain';
import { useRouter } from 'expo-router';

import { ActionRow, Pill } from '../../../design-system';
import { useClubCycles } from '../../../lib/api/queries';

/** Club header entry to "Ciclos & leituras anteriores", with the cycle in progress if any. */
export function CycleRow({ clubId, userId }: { clubId: string; userId: string }) {
  const router = useRouter();
  const cycles = useClubCycles(userId || undefined, clubId);
  const active = cycles.data?.cycles.find((cycle) => cycle.active);
  const daysLeft = active ? cycleDaysLeft(new Date(active.endsAt), new Date()) : 0;
  return (
    <ActionRow
      icon="history"
      title="Ciclos & leituras anteriores"
      subtitle={
        active
          ? `Ciclo em andamento • grupo em ${cycleGroupPercent(active)}%`
          : cycles.data?.cycles.length
            ? 'Veja o histórico do clube'
            : 'Metas de páginas com prazo, juntos'
      }
      trailing={
        active ? (
          <Pill
            tone="warning"
            icon="schedule"
            label={daysLeft === 0 ? 'Hoje' : daysLeft === 1 ? '1 dia' : `${daysLeft} dias`}
          />
        ) : undefined
      }
      onPress={() => router.push({ pathname: '/ciclos/[clubId]', params: { clubId } })}
    />
  );
}
