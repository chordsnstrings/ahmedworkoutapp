import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { DEFAULT_SETTINGS } from '@/db/seed';
import type { Settings, Units } from '@/db/types';

/** Live settings (falls back to defaults until the row is loaded). */
export function useSettings(): Settings {
  const settings = useLiveQuery(() => db.settings.get('app'), []);
  return settings ?? DEFAULT_SETTINGS;
}

export function useUnits(): Units {
  return useSettings().units;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch });
}
