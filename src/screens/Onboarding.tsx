import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Dumbbell } from 'lucide-react';
import { updateSettings } from '@/hooks/useSettings';
import { db } from '@/db/dexie';
import { uid } from '@/lib/id';
import { todayISO } from '@/lib/dates';
import { displayToKg } from '@/lib/units';
import type { Units } from '@/db/types';

const GOALS = [
  'Build muscle and get lean',
  'Lose fat & get shredded',
  'Get stronger',
  'Build a consistent habit',
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(GOALS[0]);
  const [units, setUnits] = useState<Units>('kg');
  const [bodyweight, setBodyweight] = useState('');

  const steps = ['welcome', 'name', 'goal', 'units', 'baseline'] as const;

  async function finish() {
    await updateSettings({
      name: name.trim() || 'Athlete',
      goalText: goal,
      units,
      programStartDate: todayISO(),
      onboarded: true,
    });
    if (bodyweight) {
      await db.bodyStats.put({
        id: uid('b'),
        date: todayISO(),
        weightKg: displayToKg(parseFloat(bodyweight), units),
        createdAt: Date.now(),
      });
    }
    navigate('/', { replace: true });
  }

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));

  return (
    <div className="min-h-full flex flex-col safe-top safe-bottom px-6 py-10 max-w-md mx-auto">
      {/* progress dots */}
      <div className="flex gap-2 mb-10">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-lime' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1"
        >
          {steps[step] === 'welcome' && (
            <div className="flex flex-col items-start gap-5 pt-6">
              <div className="h-16 w-16 rounded-3xl bg-lime-violet flex items-center justify-center shadow-glow">
                <Dumbbell className="text-ink-900" />
              </div>
              <h1 className="font-display text-4xl font-bold leading-tight">
                90 days to your <span className="text-lime">Apex</span>.
              </h1>
              <p className="text-white/60 text-lg">
                A guided transformation. Train, track every rep, and watch your strength climb — all
                offline, all yours.
              </p>
            </div>
          )}

          {steps[step] === 'name' && (
            <div className="pt-6">
              <h1 className="font-display text-3xl font-bold mb-2">What should we call you?</h1>
              <p className="text-white/60 mb-6">We'll greet you on your daily dashboard.</p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-ink-600 border border-white/10 rounded-2xl px-5 py-4 text-lg focus:border-lime focus:outline-none"
              />
            </div>
          )}

          {steps[step] === 'goal' && (
            <div className="pt-6">
              <h1 className="font-display text-3xl font-bold mb-2">What's your goal?</h1>
              <p className="text-white/60 mb-6">This shapes your motivation, not your plan.</p>
              <div className="flex flex-col gap-3">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    className={`flex items-center justify-between rounded-2xl px-5 py-4 text-left border transition ${
                      goal === g
                        ? 'border-lime bg-lime/10 text-white'
                        : 'border-white/10 bg-ink-600 text-white/70'
                    }`}
                  >
                    <span className="font-medium">{g}</span>
                    {goal === g && <Check size={20} className="text-lime" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {steps[step] === 'units' && (
            <div className="pt-6">
              <h1 className="font-display text-3xl font-bold mb-2">Pick your units</h1>
              <p className="text-white/60 mb-6">You can change this anytime in Settings.</p>
              <div className="grid grid-cols-2 gap-3">
                {(['kg', 'lbs'] as Units[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnits(u)}
                    className={`rounded-2xl py-8 text-2xl font-bold border transition ${
                      units === u ? 'border-lime bg-lime/10' : 'border-white/10 bg-ink-600 text-white/60'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}

          {steps[step] === 'baseline' && (
            <div className="pt-6">
              <h1 className="font-display text-3xl font-bold mb-2">Starting bodyweight</h1>
              <p className="text-white/60 mb-6">
                Optional — but it makes your Day-90 comparison hit harder.
              </p>
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  value={bodyweight}
                  onChange={(e) => setBodyweight(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-ink-600 border border-white/10 rounded-2xl px-5 py-4 text-2xl font-bold tabular focus:border-lime focus:outline-none"
                />
                <span className="text-xl text-white/50 font-semibold">{units}</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <button
        onClick={step === steps.length - 1 ? finish : next}
        className="btn-primary mt-6 flex items-center justify-center gap-2 py-4 text-lg"
      >
        {step === steps.length - 1 ? 'Start my journey' : 'Continue'}
        <ArrowRight size={20} />
      </button>
    </div>
  );
}
