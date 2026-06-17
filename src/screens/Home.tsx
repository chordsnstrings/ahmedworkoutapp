import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Play, Plus, ChevronRight, Trophy } from 'lucide-react';
import { Page } from '@/components/Page';
import { ProgressRing } from '@/components/ProgressRing';
import { useSettings } from '@/hooks/useSettings';
import { useProgramDayFor, useCompletedWorkouts, useActiveWorkout } from '@/hooks/useProgram';
import { dayOfProgram } from '@/lib/dates';
import { currentStreak } from '@/lib/streaks';
import { startFromProgramDay, startWorkout } from '@/db/repo';
import { EXERCISE_BY_ID } from '@/data/exerciseLibrary';
import { todayISO } from '@/lib/dates';

export default function Home() {
  const navigate = useNavigate();
  const settings = useSettings();
  const programDay = useProgramDayFor();
  const completed = useCompletedWorkouts();
  const active = useActiveWorkout();

  const day = dayOfProgram(settings.programStartDate);
  const progress = day / 90;
  const streak = currentStreak((completed ?? []).map((w) => w.date));
  const doneToday = (completed ?? []).some((w) => w.date === todayISO());

  async function beginToday() {
    if (active) return navigate('/workout');
    if (programDay && programDay.splitType !== 'Rest') {
      await startFromProgramDay(programDay);
    } else {
      await startWorkout({ title: 'Freestyle Session' });
    }
    navigate('/workout');
  }

  async function beginFreestyle() {
    if (!active) await startWorkout({ title: 'Freestyle Session' });
    navigate('/workout');
  }

  const isRest = programDay?.splitType === 'Rest';

  return (
    <Page>
      <header className="flex items-center justify-between mb-2">
        <div>
          <p className="text-white/50 text-sm">Welcome back</p>
          <h1 className="font-display text-2xl font-bold">{settings.name || 'Athlete'}</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1.5">
          <Flame size={16} className="text-amber" />
          <span className="font-bold tabular text-amber">{streak}</span>
        </div>
      </header>

      {/* Hero progress ring */}
      <div className="flex flex-col items-center py-6">
        <ProgressRing progress={progress} size={236}>
          <span className="text-white/50 text-xs uppercase tracking-widest">Day</span>
          <span className="font-display text-6xl font-bold tabular leading-none">{day}</span>
          <span className="text-white/40 text-sm mt-1">of 90</span>
        </ProgressRing>
        <p className="mt-4 text-center text-white/55 max-w-[16rem] text-sm">{settings.goalText}</p>
      </div>

      {/* Today's session */}
      <motion.div layout className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-widest text-lime font-semibold">
            {isRest ? 'Rest day' : "Today's session"}
          </span>
          {doneToday && (
            <span className="flex items-center gap-1 text-xs text-lime">
              <Trophy size={13} /> Completed
            </span>
          )}
        </div>
        <h2 className="font-display text-2xl font-bold mb-1">{programDay?.title ?? 'Freestyle'}</h2>
        <p className="text-white/55 text-sm mb-4">{programDay?.focusNote}</p>

        {!isRest && programDay && (
          <div className="flex flex-col gap-1.5 mb-5">
            {programDay.exerciseSlots.slice(0, 6).map((slot) => {
              const ex = EXERCISE_BY_ID[slot.exerciseId];
              return (
                <div key={slot.exerciseId} className="flex items-center justify-between text-sm">
                  <span className="text-white/80">{ex?.name ?? slot.exerciseId}</span>
                  <span className="text-white/40 tabular">
                    {slot.sets} × {slot.repRange}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={beginToday}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base"
        >
          <Play size={18} fill="currentColor" />
          {active ? 'Resume workout' : isRest ? 'Train anyway' : 'Start workout'}
        </button>
      </motion.div>

      <button
        onClick={beginFreestyle}
        className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 text-white/70 active:scale-95 transition"
      >
        <Plus size={18} /> Freestyle session
      </button>

      <button
        onClick={() => navigate('/progress')}
        className="mt-3 w-full card flex items-center justify-between p-4"
      >
        <span className="text-white/80 font-medium">View your progress</span>
        <ChevronRight size={20} className="text-white/40" />
      </button>
    </Page>
  );
}
