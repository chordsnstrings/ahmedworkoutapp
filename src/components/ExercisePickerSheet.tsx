import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import type { Exercise, MuscleGroup } from '@/db/types';

const GROUPS: (MuscleGroup | 'All')[] = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Cardio'];

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}

export function ExercisePickerSheet({ open, title = 'Add exercise', onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'All'>('All');
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];

  const filtered = useMemo(() => {
    return exercises
      .filter((e) => (group === 'All' ? true : e.muscleGroup === group))
      .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, group, query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-ink-900/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-[71] max-h-[85vh] mx-auto max-w-md rounded-t-4xl bg-ink-700 border-t border-white/10 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h3 className="font-display text-xl font-bold">{title}</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5">
                <X size={18} />
              </button>
            </div>

            <div className="px-5">
              <div className="flex items-center gap-2 rounded-2xl bg-ink-600 px-4 py-3 border border-white/5">
                <Search size={18} className="text-white/40" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search exercises…"
                  className="flex-1 bg-transparent focus:outline-none text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-3">
              {GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    group === g ? 'bg-lime text-ink-900' : 'bg-white/5 text-white/60'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8 safe-bottom">
              <div className="flex flex-col gap-1.5">
                {filtered.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => {
                      onPick(ex);
                      onClose();
                    }}
                    className="flex items-center justify-between rounded-2xl bg-ink-600 px-4 py-3.5 text-left active:scale-[0.98] transition"
                  >
                    <div>
                      <p className="font-medium">{ex.name}</p>
                      <p className="text-xs text-white/40">
                        {ex.equipment} · {ex.category}
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-wide text-violet-400">
                      {ex.muscleGroup}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-white/40 py-10">No exercises found.</p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
