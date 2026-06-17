import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import type { SetLog } from '@/db/types';

/** Live set logs for a workout, ordered by creation. */
export function useWorkoutSets(workoutId: string | undefined): SetLog[] {
  return (
    useLiveQuery(
      () =>
        workoutId
          ? db.setLogs.where('workoutId').equals(workoutId).sortBy('createdAt')
          : Promise.resolve([] as SetLog[]),
      [workoutId],
    ) ?? []
  );
}

/** All-time personal records keyed by exercise id. */
export function usePRs() {
  return useLiveQuery(() => db.personalRecords.toArray(), []) ?? [];
}
