import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Flag, Timer } from 'lucide-react';
import { db } from '@/db/dexie';
import { useActiveWorkout, useProgramDayFor } from '@/hooks/useProgram';
import { useWorkoutSets } from '@/hooks/useWorkout';
import { useSettings } from '@/hooks/useSettings';
import { useRestTimer } from '@/store/restTimer';
import { addSet, finishWorkout, discardWorkout, swapExerciseInWorkout } from '@/db/repo';
import { ExerciseSessionCard } from '@/components/ExerciseSessionCard';
import { ExercisePickerSheet } from '@/components/ExercisePickerSheet';
import { PRCelebration } from '@/components/PRCelebration';
import type { Exercise } from '@/db/types';

export default function WorkoutPlayer() {
  const navigate = useNavigate();
  const workout = useActiveWorkout();
  const settings = useSettings();
  const sets = useWorkoutSets(workout?.id);
  const programDay = useProgramDayFor(workout?.date);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const startRest = useRestTimer((s) => s.start);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [showPR, setShowPR] = useState(false);
  const [elapsed, setElapsed] = useState('0:00');

  const exerciseMap = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])) as Record<string, Exercise>,
    [exercises],
  );

  // Redirect home if there's no active workout (e.g. after finishing).
  useEffect(() => {
    if (workout === undefined) return; // still loading
    if (workout === null) navigate('/', { replace: true });
  }, [workout, navigate]);

  // Live elapsed-time ticker.
  useEffect(() => {
    if (!workout) return;
    const tick = () => {
      const s = Math.floor((Date.now() - workout.startedAt) / 1000);
      setElapsed(`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`);
    };
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [workout]);

  // Ordered exercise list: program slots first, then anything else added.
  const orderedExerciseIds = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    const matchesDay = programDay && workout?.programDayId === programDay.id;
    if (matchesDay) {
      for (const slot of programDay!.exerciseSlots) {
        if (!seen.has(slot.exerciseId)) {
          order.push(slot.exerciseId);
          seen.add(slot.exerciseId);
        }
      }
    }
    for (const s of sets) {
      if (!seen.has(s.exerciseId)) {
        order.push(s.exerciseId);
        seen.add(s.exerciseId);
      }
    }
    return order;
  }, [programDay, workout?.programDayId, sets]);

  const targetLabelFor = (exId: string): string | undefined => {
    const slot = programDay?.exerciseSlots.find((s) => s.exerciseId === exId);
    return slot ? `${slot.sets}×${slot.repRange}` : undefined;
  };

  function handleSetComplete(isPR: boolean) {
    startRest(settings.defaultRestSeconds);
    if (isPR) setShowPR(true);
    // Ask for notification permission once, opportunistically.
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  async function handlePick(ex: Exercise) {
    if (!workout) return;
    if (swapTarget) {
      await swapExerciseInWorkout(workout.id, swapTarget, ex.id);
      setSwapTarget(null);
    } else {
      await addSet(workout.id, ex.id, {});
    }
  }

  async function handleFinish() {
    if (!workout) return;
    const hasCompleted = sets.some((s) => s.completed);
    if (!hasCompleted) {
      await discardWorkout(workout.id);
    } else {
      await finishWorkout(workout.id);
    }
    navigate('/', { replace: true });
  }

  if (!workout) return null;

  const completedCount = sets.filter((s) => s.completed).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-full safe-top pb-40"
    >
      {/* Sticky header */}
      <header className="sticky top-0 z-30 bg-ink-900/85 backdrop-blur-md px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-white/60 active:scale-95 transition"
          >
            <ArrowLeft size={20} /> <span className="text-sm">Home</span>
          </button>
          <div className="flex items-center gap-1.5 text-white/70">
            <Timer size={15} />
            <span className="tabular text-sm font-semibold">{elapsed}</span>
          </div>
          <button
            onClick={handleFinish}
            className="flex items-center gap-1.5 rounded-xl bg-lime px-3.5 py-1.5 text-sm font-bold text-ink-900 active:scale-95 transition"
          >
            <Flag size={15} /> Finish
          </button>
        </div>
        <div className="mt-3">
          <h1 className="font-display text-2xl font-bold">{workout.title}</h1>
          <p className="text-white/45 text-sm">{completedCount} sets completed</p>
        </div>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">
        {orderedExerciseIds.map((exId) => {
          const ex = exerciseMap[exId];
          if (!ex) return null;
          const exSets = sets.filter((s) => s.exerciseId === exId);
          return (
            <ExerciseSessionCard
              key={exId}
              exercise={ex}
              sets={exSets}
              units={settings.units}
              workoutId={workout.id}
              targetLabel={targetLabelFor(exId)}
              onComplete={handleSetComplete}
              onSwap={() => {
                setSwapTarget(exId);
                setPickerOpen(true);
              }}
            />
          );
        })}

        <button
          onClick={() => {
            setSwapTarget(null);
            setPickerOpen(true);
          }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-dashed border-white/15 text-white/70 active:scale-95 transition"
        >
          <Plus size={18} /> Add exercise
        </button>
      </div>

      <ExercisePickerSheet
        open={pickerOpen}
        title={swapTarget ? 'Swap exercise' : 'Add exercise'}
        onClose={() => {
          setPickerOpen(false);
          setSwapTarget(null);
        }}
        onPick={handlePick}
      />
      <PRCelebration show={showPR} onDone={() => setShowPR(false)} />
    </motion.div>
  );
}
