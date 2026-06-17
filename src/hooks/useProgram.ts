import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { dayOffset, todayISO } from '@/lib/dates';
import { useSettings } from './useSettings';
import type { ProgramDay, Workout } from '@/db/types';

/** Resolve the scheduled program day for a given calendar date. */
export function useProgramDayFor(dateISO: string = todayISO()): ProgramDay | undefined {
  const settings = useSettings();
  return useLiveQuery(async () => {
    const offset = dayOffset(settings.programStartDate, dateISO);
    if (offset < 0) return undefined;
    const week = Math.floor(offset / 7);
    const day = offset % 7;
    return db.programDays.get(`${week}-${day}`);
  }, [settings.programStartDate, dateISO]);
}

/** All completed workouts, newest first. */
export function useCompletedWorkouts(): Workout[] | undefined {
  return useLiveQuery(
    () => db.workouts.where('status').equals('completed').reverse().sortBy('startedAt'),
    [],
  );
}

/** The single active (in-progress) workout, if any. */
export function useActiveWorkout(): Workout | undefined | null {
  const result = useLiveQuery(() => db.workouts.where('status').equals('active').first(), []);
  return result;
}
