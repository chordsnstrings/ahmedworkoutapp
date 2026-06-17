import { db } from './dexie';
import { uid } from '@/lib/id';
import { todayISO } from '@/lib/dates';
import { evaluatePR } from '@/lib/prDetection';
import type { ProgramDay, SetLog, Workout } from './types';

// ---------------- Workouts ----------------

/** Returns the in-progress workout, if any. */
export async function getActiveWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('status').equals('active').first();
}

export async function startWorkout(opts: {
  title: string;
  programDayId?: string;
}): Promise<Workout> {
  // Only one active workout at a time — resume an existing one.
  const existing = await getActiveWorkout();
  if (existing) return existing;

  const workout: Workout = {
    id: uid('w'),
    date: todayISO(),
    programDayId: opts.programDayId,
    title: opts.title,
    status: 'active',
    startedAt: Date.now(),
  };
  await db.workouts.put(workout);
  return workout;
}

export async function startFromProgramDay(day: ProgramDay): Promise<Workout> {
  const workout = await startWorkout({ title: day.title, programDayId: day.id });
  // Seed the prescribed sets (empty, ready to fill) only on a fresh workout.
  const existing = await db.setLogs.where('workoutId').equals(workout.id).count();
  if (existing === 0) {
    for (const slot of day.exerciseSlots) {
      for (let i = 0; i < slot.sets; i++) {
        await addSet(workout.id, slot.exerciseId, {});
      }
    }
  }
  return workout;
}

export async function finishWorkout(workoutId: string): Promise<void> {
  await db.workouts.update(workoutId, {
    status: 'completed',
    completedAt: Date.now(),
  });
  // Drop empty (no completed sets) workouts so history stays clean.
  const completedSets = await db.setLogs
    .where('workoutId')
    .equals(workoutId)
    .filter((s) => s.completed)
    .count();
  if (completedSets === 0) {
    await discardWorkout(workoutId);
  }
}

export async function discardWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.setLogs, async () => {
    await db.setLogs.where('workoutId').equals(workoutId).delete();
    await db.workouts.delete(workoutId);
  });
}

// ---------------- Sets ----------------

export async function getSetsForWorkout(workoutId: string): Promise<SetLog[]> {
  return db.setLogs.where('workoutId').equals(workoutId).sortBy('createdAt');
}

export async function addSet(
  workoutId: string,
  exerciseId: string,
  partial: Partial<Pick<SetLog, 'weightKg' | 'reps' | 'isWarmup' | 'rpe'>> = {},
): Promise<SetLog> {
  const existing = await db.setLogs
    .where('workoutId')
    .equals(workoutId)
    .filter((s) => s.exerciseId === exerciseId)
    .toArray();
  const setNumber = existing.length + 1;

  const set: SetLog = {
    id: uid('s'),
    workoutId,
    exerciseId,
    setNumber,
    weightKg: partial.weightKg ?? 0,
    reps: partial.reps ?? 0,
    rpe: partial.rpe,
    isWarmup: partial.isWarmup ?? false,
    completed: false,
    isPR: false,
    createdAt: Date.now(),
  };
  await db.setLogs.put(set);
  return set;
}

export async function updateSet(id: string, patch: Partial<SetLog>): Promise<void> {
  await db.setLogs.update(id, patch);
}

export async function deleteSet(id: string): Promise<void> {
  await db.setLogs.delete(id);
}

/**
 * Mark a set complete, then evaluate it for a personal record.
 * Returns true when a *new* PR was set (for celebration).
 */
export async function completeSet(id: string): Promise<boolean> {
  const set = await db.setLogs.get(id);
  if (!set) return false;
  const isPR = await evaluatePR(set.exerciseId, set.weightKg, set.reps, set.isWarmup);
  await db.setLogs.update(id, { completed: true, isPR });
  return isPR;
}

/** Re-point every set of one exercise in a workout to another exercise. */
export async function swapExerciseInWorkout(
  workoutId: string,
  fromExerciseId: string,
  toExerciseId: string,
): Promise<void> {
  const sets = await db.setLogs
    .where('workoutId')
    .equals(workoutId)
    .filter((s) => s.exerciseId === fromExerciseId)
    .toArray();
  await Promise.all(
    sets.map((s) => db.setLogs.update(s.id, { exerciseId: toExerciseId, completed: false, isPR: false })),
  );
}

/**
 * Find the most recent completed working set for an exercise in a *previous*
 * workout — shown as the target to beat for progressive overload.
 */
export async function getLastPerformance(
  exerciseId: string,
  excludeWorkoutId: string,
): Promise<{ weightKg: number; reps: number; date: string } | undefined> {
  const logs = await db.setLogs
    .where('exerciseId')
    .equals(exerciseId)
    .filter((s) => s.completed && !s.isWarmup && s.workoutId !== excludeWorkoutId)
    .reverse()
    .sortBy('createdAt');
  if (logs.length === 0) return undefined;
  const best = logs[0];
  const workout = await db.workouts.get(best.workoutId);
  return { weightKg: best.weightKg, reps: best.reps, date: workout?.date ?? '' };
}
