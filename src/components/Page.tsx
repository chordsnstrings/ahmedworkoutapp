import { motion } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  /** Extra bottom padding so content clears the tab bar. */
  withTabBar?: boolean;
  className?: string;
}

/** Standard animated screen wrapper for fluid route transitions. */
export function Page({ children, withTabBar = true, className = '' }: Props) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`safe-top px-4 pt-6 ${withTabBar ? 'pb-32' : 'pb-6'} ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-6 first:mt-0">
      <h2 className="font-display text-sm uppercase tracking-widest text-white/45">{children}</h2>
      {action}
    </div>
  );
}
