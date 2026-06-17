import { db } from '@/db/dexie';
import { estimated1RM } from './oneRepMax';

/**
 * Evaluate a completed set against the stored personal record for its exercise.
 * If the set's estimated 1RM beats the record, the PR is updated and `true` is
 * returned so the UI can celebrate. Warm-up sets never count.
 */
export async function evaluatePR(
  exerciseId: string,
  weightKg: number,
  reps: number,
  isWarmup: boolean,
): Promise<boolean> {
  if (isWarmup || weightKg <= 0 || reps <= 0) return false;

  const e1rm = estimated1RM(weightKg, reps);
  const existing = await db.personalRecords.get(exerciseId);

  if (!existing || e1rm > existing.bestEstimated1RM + 0.01) {
    await db.personalRecords.put({
      exerciseId,
      bestEstimated1RM: e1rm,
      bestWeightKg: weightKg,
      bestReps: reps,
      achievedAt: Date.now(),
    });
    // It's only a "new PR" worth celebrating if one already existed before.
    return Boolean(existing);
  }
  return false;
}

/** Recompute every PR from scratch (used after deletes / imports). */
export async function recomputeAllPRs(): Promise<void> {
  const logs = await db.setLogs.toArray();
  const best: Record<string, { e1rm: number; weightKg: number; reps: number; at: number }> = {};
  for (const log of logs) {
    if (log.isWarmup || !log.completed) continue;
    const e1rm = estimated1RM(log.weightKg, log.reps);
    const cur = best[log.exerciseId];
    if (!cur || e1rm > cur.e1rm) {
      best[log.exerciseId] = { e1rm, weightKg: log.weightKg, reps: log.reps, at: log.createdAt };
    }
  }
  await db.personalRecords.clear();
  await db.personalRecords.bulkPut(
    Object.entries(best).map(([exerciseId, b]) => ({
      exerciseId,
      bestEstimated1RM: b.e1rm,
      bestWeightKg: b.weightKg,
      bestReps: b.reps,
      achievedAt: b.at,
    })),
  );
}
