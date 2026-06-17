import { db } from './dexie';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { buildProgram90 } from '@/data/program90';
import type { Settings } from './types';

const SEED_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  units: 'kg',
  defaultRestSeconds: 90,
  programStartDate: new Date().toISOString().slice(0, 10),
  goalText: 'Build muscle and get lean in 90 days',
  name: '',
  onboarded: false,
  seedVersion: SEED_VERSION,
};

/**
 * Idempotently seed the exercise library, program template, and default
 * settings into IndexedDB. Safe to call on every app boot.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.exercises, db.programDays, db.settings, async () => {
    const exerciseCount = await db.exercises.count();
    if (exerciseCount === 0) {
      await db.exercises.bulkPut(EXERCISE_LIBRARY);
    } else {
      // Refresh non-custom library entries without touching user-created ones.
      await db.exercises.bulkPut(EXERCISE_LIBRARY);
    }

    const programCount = await db.programDays.count();
    if (programCount === 0) {
      await db.programDays.bulkPut(buildProgram90());
    }

    const settings = await db.settings.get('app');
    if (!settings) {
      await db.settings.put(DEFAULT_SETTINGS);
    }
  });
}

/** Wipe all data (used by Settings → reset). */
export async function resetAllData(): Promise<void> {
  await Promise.all([
    db.exercises.clear(),
    db.programDays.clear(),
    db.workouts.clear(),
    db.setLogs.clear(),
    db.bodyStats.clear(),
    db.photos.clear(),
    db.personalRecords.clear(),
    db.settings.clear(),
  ]);
  await ensureSeeded();
}
