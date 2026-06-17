import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X, Timer } from 'lucide-react';
import { useRestTimer } from '@/store/restTimer';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Floating rest-timer pill that persists across navigation while running. */
export function RestTimerBar() {
  const running = useRestTimer((s) => s.running);
  const remaining = useRestTimer((s) => s.remaining());
  const duration = useRestTimer((s) => s.durationSec);
  const addTime = useRestTimer((s) => s.addTime);
  const stop = useRestTimer((s) => s.stop);

  const progress = duration > 0 ? remaining / duration : 0;

  return (
    <AnimatePresence>
      {running && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          className="fixed bottom-24 inset-x-0 z-50 px-4 pointer-events-none"
        >
          <div className="mx-auto max-w-md pointer-events-auto">
            <div className="relative overflow-hidden rounded-2xl bg-ink-500 border border-white/10 shadow-glow-violet">
              <motion.div
                className="absolute inset-y-0 left-0 bg-violet/25"
                animate={{ width: `${progress * 100}%` }}
                transition={{ ease: 'linear', duration: 0.25 }}
              />
              <div className="relative flex items-center gap-3 px-4 py-3">
                <Timer size={20} className="text-violet-400" />
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wide text-white/50">Rest</div>
                  <div className="text-xl font-bold tabular leading-none">{fmt(remaining)}</div>
                </div>
                <button
                  onClick={() => addTime(15)}
                  className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold active:scale-95 transition"
                >
                  <Plus size={14} /> 15s
                </button>
                <button
                  onClick={stop}
                  className="rounded-xl bg-white/10 p-2 active:scale-95 transition"
                  aria-label="Skip rest"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
