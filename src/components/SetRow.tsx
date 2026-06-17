import { motion } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import type { SetLog, Units } from '@/db/types';
import { kgToDisplay, displayToKg, weightStepKg } from '@/lib/units';
import { updateSet, deleteSet, completeSet } from '@/db/repo';

interface Props {
  set: SetLog;
  index: number;
  units: Units;
  prevLabel?: string;
  onComplete: (isPR: boolean) => void;
}

export function SetRow({ set, index, units, prevLabel, onComplete }: Props) {
  const step = weightStepKg(units);

  async function adjustWeight(dir: number) {
    const next = Math.max(0, set.weightKg + dir * step);
    await updateSet(set.id, { weightKg: next });
  }

  async function setWeightFromInput(v: string) {
    const num = parseFloat(v);
    await updateSet(set.id, { weightKg: Number.isFinite(num) ? displayToKg(num, units) : 0 });
  }

  async function adjustReps(dir: number) {
    await updateSet(set.id, { reps: Math.max(0, set.reps + dir) });
  }

  async function toggleComplete() {
    if (set.completed) {
      await updateSet(set.id, { completed: false, isPR: false });
      return;
    }
    const isPR = await completeSet(set.id);
    onComplete(isPR);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2 rounded-2xl px-2.5 py-2 transition-colors ${
        set.completed ? 'bg-lime/10' : 'bg-ink-700/60'
      }`}
    >
      {/* set number / warmup badge */}
      <button
        onClick={() => updateSet(set.id, { isWarmup: !set.isWarmup })}
        className={`h-8 w-8 shrink-0 rounded-xl text-xs font-bold flex items-center justify-center ${
          set.isWarmup ? 'bg-amber/20 text-amber' : 'bg-white/5 text-white/60'
        }`}
        title="Toggle warm-up set"
      >
        {set.isWarmup ? 'W' : index}
      </button>

      {/* weight */}
      <div className="flex-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => adjustWeight(-1)}
            className="h-8 w-7 rounded-lg bg-white/5 text-white/60 text-lg leading-none active:scale-90 transition"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            value={set.weightKg ? kgToDisplay(set.weightKg, units) : ''}
            onChange={(e) => setWeightFromInput(e.target.value)}
            placeholder="0"
            className="w-full min-w-0 bg-transparent text-center text-lg font-bold tabular focus:outline-none"
          />
          <button
            onClick={() => adjustWeight(1)}
            className="h-8 w-7 rounded-lg bg-white/5 text-white/60 text-lg leading-none active:scale-90 transition"
          >
            +
          </button>
        </div>
        {prevLabel && <p className="text-center text-[10px] text-white/35 mt-0.5">{prevLabel}</p>}
      </div>

      <span className="text-white/25 text-sm">×</span>

      {/* reps */}
      <div className="flex items-center gap-1 flex-1">
        <button
          onClick={() => adjustReps(-1)}
          className="h-8 w-7 rounded-lg bg-white/5 text-white/60 text-lg leading-none active:scale-90 transition"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={set.reps || ''}
          onChange={(e) => updateSet(set.id, { reps: Math.max(0, parseInt(e.target.value) || 0) })}
          placeholder="0"
          className="w-full min-w-0 bg-transparent text-center text-lg font-bold tabular focus:outline-none"
        />
        <button
          onClick={() => adjustReps(1)}
          className="h-8 w-7 rounded-lg bg-white/5 text-white/60 text-lg leading-none active:scale-90 transition"
        >
          +
        </button>
      </div>

      {/* complete */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={toggleComplete}
        className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
          set.completed ? 'bg-lime text-ink-900' : 'bg-white/5 text-white/40'
        }`}
      >
        <Check size={18} strokeWidth={3} />
      </motion.button>

      <button
        onClick={() => deleteSet(set.id)}
        className="h-9 w-7 shrink-0 text-white/20 hover:text-coral transition"
        aria-label="Delete set"
      >
        <Trash2 size={15} />
      </button>
    </motion.div>
  );
}
