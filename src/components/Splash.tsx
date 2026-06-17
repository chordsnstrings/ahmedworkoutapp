import { motion } from 'framer-motion';

export function Splash() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-4 bg-ink-900">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="h-20 w-20 rounded-3xl bg-lime-violet flex items-center justify-center shadow-glow"
      >
        <span className="text-3xl font-display font-bold text-ink-900">A</span>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="font-display text-lg tracking-wide text-white/80"
      >
        Apex
      </motion.p>
    </div>
  );
}
