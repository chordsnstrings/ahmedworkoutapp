import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Dumbbell, LineChart, Calendar, Settings } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Today', Icon: Home },
  { to: '/library', label: 'Library', Icon: Dumbbell },
  { to: '/progress', label: 'Progress', Icon: LineChart },
  { to: '/history', label: 'History', Icon: Calendar },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

export function TabBar() {
  const location = useLocation();
  // Hide the tab bar inside the immersive workout player & onboarding.
  if (location.pathname.startsWith('/workout') || location.pathname.startsWith('/onboarding')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-4 pb-3">
        <div className="card flex items-center justify-around py-2 px-1 rounded-3xl border-white/10 bg-ink-700/90">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="relative flex-1">
              {({ isActive }) => (
                <div className="flex flex-col items-center gap-1 py-1.5">
                  {isActive && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-2xl bg-lime/10"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon
                    size={22}
                    className={`relative transition-colors ${isActive ? 'text-lime' : 'text-white/45'}`}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  <span
                    className={`relative text-[10px] font-medium transition-colors ${
                      isActive ? 'text-lime' : 'text-white/45'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
