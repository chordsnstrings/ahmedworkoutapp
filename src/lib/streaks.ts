import { differenceInCalendarDays, parseISO } from 'date-fns';
import { todayISO } from './dates';

/**
 * Current streak = consecutive days (ending today or yesterday) that have at
 * least one completed workout. Training every-other-day still counts toward
 * adherence via the longest-streak / total metrics elsewhere.
 */
export function currentStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  const today = todayISO();
  // Allow the streak to be "alive" if the most recent day was today or yesterday.
  let cursor = parseISO(today);
  if (!set.has(today)) {
    const yesterday = new Date(cursor);
    yesterday.setDate(cursor.getDate() - 1);
    if (!set.has(yesterday.toISOString().slice(0, 10))) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function longestStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const sorted = [...new Set(completedDates)].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = differenceInCalendarDays(parseISO(sorted[i]), parseISO(sorted[i - 1]));
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}
