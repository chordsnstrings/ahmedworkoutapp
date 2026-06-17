import { AnimatePresence, motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

const COLORS = ['#c6ff00', '#7c5cff', '#00e0d0', '#ffb02e', '#ff5c7c'];

interface Props {
  show: boolean;
  onDone: () => void;
}

/** Brief, celebratory burst when a new personal record is hit. */
export function PRCelebration({ show, onDone }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={() => setTimeout(onDone, 1400)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/70 backdrop-blur-sm pointer-events-none"
        >
          {/* confetti */}
          {Array.from({ length: 28 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{
                x: (Math.random() - 0.5) * 360,
                y: (Math.random() - 0.5) * 520,
                opacity: 0,
                rotate: Math.random() * 540,
              }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="h-24 w-24 rounded-full bg-lime-violet flex items-center justify-center shadow-glow">
              <Trophy size={44} className="text-ink-900" />
            </div>
            <p className="font-display text-3xl font-bold">New PR! 🔥</p>
            <p className="text-white/70">You just got stronger.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
