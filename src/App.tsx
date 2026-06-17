import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ensureSeeded } from '@/db/seed';
import { useSettings } from '@/hooks/useSettings';
import { TabBar } from '@/components/TabBar';
import { RestTimerBar } from '@/components/RestTimerBar';
import { Splash } from '@/components/Splash';
import Onboarding from '@/screens/Onboarding';
import Home from '@/screens/Home';
import WorkoutPlayer from '@/screens/WorkoutPlayer';
import Library from '@/screens/Library';
import Progress from '@/screens/Progress';
import History from '@/screens/History';
import Settings from '@/screens/Settings';

export default function App() {
  const [ready, setReady] = useState(false);
  const settings = useSettings();
  const location = useLocation();

  useEffect(() => {
    ensureSeeded().finally(() => setReady(true));
  }, []);

  if (!ready) return <Splash />;

  const onboarded = settings.onboarded;

  return (
    <div className="mx-auto max-w-md min-h-full relative">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/onboarding"
            element={onboarded ? <Navigate to="/" replace /> : <Onboarding />}
          />
          {!onboarded ? (
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          ) : (
            <>
              <Route path="/" element={<Home />} />
              <Route path="/workout" element={<WorkoutPlayer />} />
              <Route path="/library" element={<Library />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </AnimatePresence>

      <RestTimerBar />
      <TabBar />
    </div>
  );
}
