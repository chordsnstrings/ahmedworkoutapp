import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Dumbbell } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '@/components/Page';
import { db } from '@/db/dexie';
import { uid } from '@/lib/id';
import type { Equipment, Exercise, MuscleGroup } from '@/db/types';

const GROUPS: (MuscleGroup | 'All')[] = ['All', 'Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Cardio'];
const EQUIPMENT: Equipment[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Other'];
const MUSCLES: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Cardio'];

export default function Library() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'All'>('All');
  const [adding, setAdding] = useState(false);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];

  const filtered = useMemo(
    () =>
      exercises
        .filter((e) => (group === 'All' ? true : e.muscleGroup === group))
        .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [exercises, group, query],
  );

  return (
    <Page>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-3xl font-bold">Library</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-xl bg-lime/15 text-lime px-3 py-2 text-sm font-semibold active:scale-95 transition"
        >
          <Plus size={16} /> Custom
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl bg-ink-600 px-4 py-3 border border-white/5 mb-3">
        <Search size={18} className="text-white/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          className="flex-1 bg-transparent focus:outline-none placeholder:text-white/30"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
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

      <p className="text-white/40 text-sm mb-2">{filtered.length} exercises</p>
      <div className="flex flex-col gap-1.5">
        {filtered.map((ex) => (
          <motion.div
            layout
            key={ex.id}
            className="card flex items-center gap-3 p-3.5"
          >
            <div className="h-10 w-10 rounded-xl bg-violet/15 flex items-center justify-center">
              <Dumbbell size={18} className="text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{ex.name}</p>
              <p className="text-xs text-white/40">
                {ex.equipment} · {ex.category}
                {ex.isCustom && <span className="text-lime"> · custom</span>}
              </p>
            </div>
            <span className="text-[11px] uppercase tracking-wide text-violet-400 shrink-0">
              {ex.muscleGroup}
            </span>
          </motion.div>
        ))}
      </div>

      <AddExerciseSheet open={adding} onClose={() => setAdding(false)} />
    </Page>
  );
}

function AddExerciseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('Chest');
  const [equipment, setEquipment] = useState<Equipment>('Barbell');

  async function save() {
    if (!name.trim()) return;
    const ex: Exercise = {
      id: uid('cust'),
      name: name.trim(),
      muscleGroup: muscle,
      equipment,
      category: muscle === 'Cardio' ? 'Cardio' : 'Isolation',
      isCustom: true,
    };
    await db.exercises.put(ex);
    setName('');
    onClose();
  }

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
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto max-w-md rounded-t-4xl bg-ink-700 border-t border-white/10 p-5 safe-bottom"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-bold">New exercise</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5">
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Exercise name"
              className="w-full bg-ink-600 border border-white/10 rounded-2xl px-4 py-3.5 mb-4 focus:border-lime focus:outline-none"
            />

            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Muscle group</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMuscle(m)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                    muscle === m ? 'bg-lime text-ink-900' : 'bg-white/5 text-white/60'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Equipment</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {EQUIPMENT.map((eq) => (
                <button
                  key={eq}
                  onClick={() => setEquipment(eq)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                    equipment === eq ? 'bg-violet text-white' : 'bg-white/5 text-white/60'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>

            <button onClick={save} className="btn-primary w-full py-3.5 text-base">
              Add to library
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
