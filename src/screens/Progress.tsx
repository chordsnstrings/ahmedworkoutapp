import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import { Plus, X, Flame, Trophy, TrendingUp } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { Page, SectionTitle } from '@/components/Page';
import { db } from '@/db/dexie';
import { uid } from '@/lib/id';
import { todayISO } from '@/lib/dates';
import { useSettings } from '@/hooks/useSettings';
import { kgToDisplay, displayToKg, formatWeight } from '@/lib/units';
import { setVolume } from '@/lib/oneRepMax';
import { currentStreak, longestStreak } from '@/lib/streaks';
import { EXERCISE_BY_ID } from '@/data/exerciseLibrary';

export default function Progress() {
  const settings = useSettings();
  const units = settings.units;
  const [logWeight, setLogWeight] = useState(false);

  const workouts = useLiveQuery(() => db.workouts.where('status').equals('completed').toArray(), []) ?? [];
  const setLogs = useLiveQuery(() => db.setLogs.toArray(), []) ?? [];
  const bodyStats = useLiveQuery(() => db.bodyStats.orderBy('date').toArray(), []) ?? [];
  const prs = useLiveQuery(() => db.personalRecords.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = useMemo(
    () => ({ ...EXERCISE_BY_ID, ...Object.fromEntries(exercises.map((e) => [e.id, e])) }),
    [exercises],
  );

  // ---- Volume per workout ----
  const volumeData = useMemo(() => {
    const byWorkout = new Map<string, number>();
    for (const s of setLogs) {
      if (!s.completed || s.isWarmup) continue;
      byWorkout.set(s.workoutId, (byWorkout.get(s.workoutId) ?? 0) + setVolume(s.weightKg, s.reps));
    }
    return workouts
      .slice()
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((w) => ({
        date: format(parseISO(w.date), 'M/d'),
        volume: Math.round(kgToDisplay(byWorkout.get(w.id) ?? 0, units)),
      }))
      .filter((d) => d.volume > 0)
      .slice(-14);
  }, [setLogs, workouts, units]);

  // ---- Bodyweight trend ----
  const weightData = useMemo(
    () =>
      bodyStats
        .filter((b) => b.weightKg != null)
        .map((b) => ({
          date: format(parseISO(b.date), 'M/d'),
          weight: Math.round(kgToDisplay(b.weightKg!, units) * 10) / 10,
        })),
    [bodyStats, units],
  );

  const completedDates = workouts.map((w) => w.date);
  const streak = currentStreak(completedDates);
  const best = longestStreak(completedDates);

  const sortedPRs = useMemo(
    () => prs.slice().sort((a, b) => b.bestEstimated1RM - a.bestEstimated1RM).slice(0, 8),
    [prs],
  );

  const latestWeight = weightData.at(-1)?.weight;
  const firstWeight = weightData[0]?.weight;
  const weightDelta = latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null;

  return (
    <Page>
      <h1 className="font-display text-3xl font-bold mb-4">Progress</h1>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3 mb-2">
        <StatTile icon={<Flame size={16} className="text-amber" />} label="Streak" value={`${streak}d`} />
        <StatTile icon={<Trophy size={16} className="text-lime" />} label="Workouts" value={`${workouts.length}`} />
        <StatTile icon={<TrendingUp size={16} className="text-violet-400" />} label="Best run" value={`${best}d`} />
      </div>

      {/* Volume chart */}
      <SectionTitle>Training Volume</SectionTitle>
      <div className="card p-4">
        {volumeData.length > 1 ? (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={volumeData}>
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ background: '#1d1d28', border: 'none', borderRadius: 12, color: '#fff' }}
                formatter={(v: number) => [`${v} ${units}`, 'Volume']}
              />
              <Bar dataKey="volume" fill="#c6ff00" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyHint>Complete a few workouts to see your volume climb.</EmptyHint>
        )}
      </div>

      {/* Bodyweight */}
      <SectionTitle
        action={
          <button
            onClick={() => setLogWeight(true)}
            className="flex items-center gap-1 text-xs text-lime font-semibold"
          >
            <Plus size={14} /> Log
          </button>
        }
      >
        Bodyweight
      </SectionTitle>
      <div className="card p-4">
        {weightData.length > 1 ? (
          <>
            {weightDelta != null && (
              <p className="text-sm text-white/60 mb-2">
                <span className={weightDelta <= 0 ? 'text-lime' : 'text-amber'}>
                  {weightDelta > 0 ? '+' : ''}
                  {weightDelta.toFixed(1)} {units}
                </span>{' '}
                since you started
              </p>
            )}
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={weightData}>
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
                <Tooltip
                  contentStyle={{ background: '#1d1d28', border: 'none', borderRadius: 12, color: '#fff' }}
                  formatter={(v: number) => [`${v} ${units}`, 'Weight']}
                />
                <Line type="monotone" dataKey="weight" stroke="#7c5cff" strokeWidth={3} dot={{ r: 3, fill: '#7c5cff' }} />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <EmptyHint>Log your weight regularly to track the trend.</EmptyHint>
        )}
      </div>

      {/* PRs */}
      <SectionTitle>Personal Records</SectionTitle>
      <div className="card p-2">
        {sortedPRs.length > 0 ? (
          <div className="flex flex-col">
            {sortedPRs.map((pr) => (
              <div key={pr.exerciseId} className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 last:border-0">
                <span className="text-sm font-medium truncate pr-2">
                  {exMap[pr.exerciseId]?.name ?? pr.exerciseId}
                </span>
                <div className="text-right shrink-0">
                  <span className="font-bold tabular text-lime">
                    {formatWeight(pr.bestWeightKg, units, { withUnit: false })}×{pr.bestReps}
                  </span>
                  <span className="block text-[10px] text-white/40">
                    ~{formatWeight(pr.bestEstimated1RM, units)} 1RM
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint>Your records appear here as you train.</EmptyHint>
        )}
      </div>

      {/* Photos */}
      <SectionTitle>Transformation Photos</SectionTitle>
      <PhotoSection />

      <LogWeightSheet open={logWeight} onClose={() => setLogWeight(false)} units={units} />
    </Page>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      {icon}
      <span className="font-display text-2xl font-bold tabular">{value}</span>
      <span className="text-[11px] text-white/45">{label}</span>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-white/40 text-sm py-8">{children}</p>;
}

// ---------------- Photos ----------------

function PhotoSection() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').toArray(), []) ?? [];
  const urls = useMemo(() => photos.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) })), [photos]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await db.photos.put({
      id: uid('p'),
      date: todayISO(),
      blob: file,
      label: format(new Date(), 'MMM d'),
      createdAt: Date.now(),
    });
    e.target.value = '';
  }

  return (
    <div className="card p-4">
      {urls.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {urls.map((p) => (
            <div key={p.id} className="relative aspect-[3/4] rounded-2xl overflow-hidden group">
              <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 right-1 text-[10px] text-center bg-ink-900/70 rounded py-0.5">
                {p.label}
              </span>
              <button
                onClick={() => db.photos.delete(p.id)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-ink-900/80 flex items-center justify-center text-white/70"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/15 text-white/60 active:scale-95 transition cursor-pointer">
        <Plus size={18} /> Add progress photo
        <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      </label>
      {urls.length === 0 && (
        <p className="text-center text-white/35 text-xs mt-3">
          Snap a Day 1 photo — your future self will thank you.
        </p>
      )}
    </div>
  );
}

// ---------------- Log weight sheet ----------------

function LogWeightSheet({ open, onClose, units }: { open: boolean; onClose: () => void; units: 'kg' | 'lbs' }) {
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [arms, setArms] = useState('');

  async function save() {
    const w = parseFloat(weight);
    if (!Number.isFinite(w)) return;
    await db.bodyStats.put({
      id: uid('b'),
      date: todayISO(),
      weightKg: displayToKg(w, units),
      measurements: {
        waist: waist ? parseFloat(waist) : undefined,
        arms: arms ? parseFloat(arms) : undefined,
      },
      createdAt: Date.now(),
    });
    setWeight('');
    setWaist('');
    setArms('');
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-ink-900/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto max-w-md rounded-t-4xl bg-ink-700 border-t border-white/10 p-5 safe-bottom"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-bold">Log measurements</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5">
                <X size={18} />
              </button>
            </div>
            <Field label={`Bodyweight (${units})`} value={weight} onChange={setWeight} autoFocus />
            <Field label="Waist (cm)" value={waist} onChange={setWaist} />
            <Field label="Arms (cm)" value={arms} onChange={setArms} />
            <button onClick={save} className="btn-primary w-full py-3.5 text-base mt-2">
              Save
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block mb-3">
      <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
      <input
        autoFocus={autoFocus}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full mt-1 bg-ink-600 border border-white/10 rounded-2xl px-4 py-3 text-lg font-bold tabular focus:border-lime focus:outline-none"
      />
    </label>
  );
}
