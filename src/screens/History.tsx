import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Dumbbell, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { Page } from '@/components/Page';
import { db } from '@/db/dexie';
import { useSettings } from '@/hooks/useSettings';
import { discardWorkout } from '@/db/repo';
import { recomputeAllPRs } from '@/lib/prDetection';
import { formatWeight } from '@/lib/units';
import { setVolume } from '@/lib/oneRepMax';
import { kgToDisplay } from '@/lib/units';
import { EXERCISE_BY_ID } from '@/data/exerciseLibrary';

export default function History() {
  const settings = useSettings();
  const units = settings.units;
  const [expanded, setExpanded] = useState<string | null>(null);

  const workouts =
    useLiveQuery(() => db.workouts.where('status').equals('completed').reverse().sortBy('startedAt'), []) ?? [];
  const setLogs = useLiveQuery(() => db.setLogs.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = useMemo(
    () => ({ ...EXERCISE_BY_ID, ...Object.fromEntries(exercises.map((e) => [e.id, e])) }),
    [exercises],
  );

  const setsByWorkout = useMemo(() => {
    const map = new Map<string, typeof setLogs>();
    for (const s of setLogs) {
      if (!s.completed) continue;
      const arr = map.get(s.workoutId) ?? [];
      arr.push(s);
      map.set(s.workoutId, arr);
    }
    return map;
  }, [setLogs]);

  async function remove(id: string) {
    await discardWorkout(id);
    await recomputeAllPRs();
  }

  return (
    <Page>
      <h1 className="font-display text-3xl font-bold mb-4">History</h1>

      {workouts.length === 0 && (
        <div className="card p-8 text-center text-white/45">
          <Dumbbell className="mx-auto mb-3 text-white/30" />
          No workouts logged yet. Your journey starts today.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {workouts.map((w) => {
          const sets = setsByWorkout.get(w.id) ?? [];
          const volume = sets.reduce((sum, s) => sum + setVolume(s.weightKg, s.reps), 0);
          const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
          const duration = w.completedAt ? Math.round((w.completedAt - w.startedAt) / 60000) : 0;
          const isOpen = expanded === w.id;

          return (
            <motion.div layout key={w.id} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : w.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="text-xs text-lime font-semibold">{format(parseISO(w.date), 'EEE, MMM d')}</p>
                  <h3 className="font-display text-lg font-bold">{w.title}</h3>
                  <p className="text-xs text-white/45 mt-0.5">
                    {sets.length} sets · {exerciseIds.length} exercises · {duration}m ·{' '}
                    {Math.round(kgToDisplay(volume, units)).toLocaleString()} {units} volume
                  </p>
                </div>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                  <ChevronDown size={20} className="text-white/40" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4"
                  >
                    <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                      {exerciseIds.map((exId) => {
                        const exSets = sets.filter((s) => s.exerciseId === exId);
                        return (
                          <div key={exId} className="flex items-start justify-between text-sm">
                            <span className="text-white/80">{exMap[exId]?.name ?? exId}</span>
                            <span className="text-white/50 text-right tabular">
                              {exSets
                                .map((s) => `${formatWeight(s.weightKg, units, { withUnit: false })}×${s.reps}`)
                                .join(', ')}
                            </span>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => remove(w.id)}
                        className="mt-2 flex items-center justify-center gap-1.5 py-2 text-coral text-sm"
                      >
                        <Trash2 size={15} /> Delete workout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </Page>
  );
}
