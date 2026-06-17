import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export function isoToLabel(iso: string): string {
  return format(parseISO(iso), 'EEE, MMM d');
}

/**
 * Which day (1-based) of the 90-day journey is `date`, given a start date.
 * Clamped to 1..90.
 */
export function dayOfProgram(startISO: string, dateISO: string = todayISO()): number {
  const diff = differenceInCalendarDays(parseISO(dateISO), parseISO(startISO));
  return Math.min(90, Math.max(1, diff + 1));
}

/** Zero-based offset from the start date (can exceed program length). */
export function dayOffset(startISO: string, dateISO: string = todayISO()): number {
  return differenceInCalendarDays(parseISO(dateISO), parseISO(startISO));
}
