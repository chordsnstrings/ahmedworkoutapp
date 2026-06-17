import { db } from '@/db/dexie';
import { recomputeAllPRs } from './prDetection';

interface Backup {
  version: number;
  exportedAt: string;
  exercises: unknown[];
  settings: unknown[];
  workouts: unknown[];
  setLogs: unknown[];
  bodyStats: unknown[];
  photos: { id: string; date: string; label: string; createdAt: number; dataUrl: string }[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Serialize the entire database to a downloadable JSON file. */
export async function exportData(): Promise<void> {
  const [exercises, settings, workouts, setLogs, bodyStats, photoRows] = await Promise.all([
    db.exercises.toArray(),
    db.settings.toArray(),
    db.workouts.toArray(),
    db.setLogs.toArray(),
    db.bodyStats.toArray(),
    db.photos.toArray(),
  ]);

  const photos = await Promise.all(
    photoRows.map(async (p) => ({
      id: p.id,
      date: p.date,
      label: p.label,
      createdAt: p.createdAt,
      dataUrl: await blobToDataUrl(p.blob),
    })),
  );

  const backup: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    settings,
    workouts,
    setLogs,
    bodyStats,
    photos,
  };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apex-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Restore from a backup JSON file (replaces current data). */
export async function importData(file: File): Promise<void> {
  const text = await file.text();
  const backup = JSON.parse(text) as Backup;

  const photos = await Promise.all(
    (backup.photos ?? []).map(async (p) => ({
      id: p.id,
      date: p.date,
      label: p.label,
      createdAt: p.createdAt,
      blob: await dataUrlToBlob(p.dataUrl),
    })),
  );

  await db.transaction(
    'rw',
    [db.exercises, db.settings, db.workouts, db.setLogs, db.bodyStats, db.photos, db.personalRecords],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.settings.clear(),
        db.workouts.clear(),
        db.setLogs.clear(),
        db.bodyStats.clear(),
        db.photos.clear(),
      ]);
      await db.exercises.bulkPut(backup.exercises as never);
      await db.settings.bulkPut(backup.settings as never);
      await db.workouts.bulkPut(backup.workouts as never);
      await db.setLogs.bulkPut(backup.setLogs as never);
      await db.bodyStats.bulkPut(backup.bodyStats as never);
      await db.photos.bulkPut(photos as never);
    },
  );
  await recomputeAllPRs();
}
