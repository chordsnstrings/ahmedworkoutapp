import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, MoreVertical, Repeat, Trash2 } from 'lucide-react';
import type { Exercise, SetLog, Units } from '@/db/types';
import { SetRow } from './SetRow';
import { addSet, getLastPerformance, deleteSet } from '@/db/repo';
import { formatWeight } from '@/lib/units';

interface Props {
  exercise: Exercise;
  sets: SetLog[];
  units: Units;
  workoutId: string;
  targetLabel?: string;
  onComplete: (isPR: boolean) => void;
  onSwap: () => void;
}

export function ExerciseSessionCard({
  exercise,
  sets,
  units,
  workoutId,
  targetLabel,
  onComplete,
  onSwap,
}: Props) {
  const [prev, setPrev] = useState<{ weightKg: number; reps: number } | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLastPerformance(exercise.id, workoutId).then((p) => {
      if (!cancelled) setPrev(p);
    });
    return () => {
      cancelled = true;
    };
  }, [exercise.id, workoutId, sets.length]);

  async function handleAddSet() {
    // Prefill from the last set in this card, else from previous session.
    const last = sets[sets.length - 1];
    await addSet(workoutId, exercise.id, {
      weightKg: last?.weightKg ?? prev?.weightKg ?? 0,
      reps: last?.reps ?? prev?.reps ?? 0,
    });
  }

  async function removeExercise() {
    await Promise.all(sets.map((s) => deleteSet(s.id)));
  }

  const prevLabel = prev ? `prev ${formatWeight(prev.weightKg, units, { withUnit: false })}×${prev.reps}` : undefined;

  return (
    <motion.div layout className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight truncate">{exercise.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] uppercase tracking-wide text-violet-400">
              {exercise.muscleGroup}
            </span>
            {targetLabel && <span className="text-[11px] text-white/40">· target {targetLabel}</span>}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 transition"
          >
            <MoreVertical size={18} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="absolute right-0 top-9 z-20 w-40 rounded-2xl bg-ink-500 border border-white/10 shadow-card overflow-hidden"
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onSwap();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-white/5"
                >
                  <Repeat size={15} /> Swap exercise
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    removeExercise();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-coral hover:bg-white/5"
                >
                  <Trash2 size={15} /> Remove
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* column hints */}
      <div className="flex items-center gap-2 px-2.5 mb-1 text-[10px] uppercase tracking-wider text-white/30">
        <span className="w-8 text-center">Set</span>
        <span className="flex-1 text-center">Weight ({units})</span>
        <span className="w-4" />
        <span className="flex-1 text-center">Reps</span>
        <span className="w-16" />
      </div>

      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {sets.map((s, i) => (
            <SetRow
              key={s.id}
              set={s}
              index={i + 1}
              units={units}
              prevLabel={i === 0 ? prevLabel : undefined}
              onComplete={onComplete}
            />
          ))}
        </AnimatePresence>
      </div>

      <button
        onClick={handleAddSet}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-white/15 text-sm text-white/60 active:scale-95 transition"
      >
        <Plus size={16} /> Add set
      </button>
    </motion.div>
  );
}
