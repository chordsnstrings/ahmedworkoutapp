import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Timer, Scale, User, Target } from 'lucide-react';
import { Page, SectionTitle } from '@/components/Page';
import { useSettings, updateSettings } from '@/hooks/useSettings';
import { exportData, importData } from '@/lib/backup';
import { resetAllData } from '@/db/seed';
import { dayOfProgram } from '@/lib/dates';
import type { Units } from '@/db/types';

const REST_OPTIONS = [60, 90, 120, 180];

export default function Settings() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const day = dayOfProgram(settings.programStartDate);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy('Importing…');
    try {
      await importData(file);
    } finally {
      setBusy(null);
      e.target.value = '';
    }
  }

  async function reset() {
    if (!confirm('This wipes all workouts, logs, photos and restarts your 90 days. Continue?')) return;
    setBusy('Resetting…');
    try {
      await resetAllData();
      await updateSettings({ onboarded: false });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page>
      <h1 className="font-display text-3xl font-bold mb-1">Settings</h1>
      <p className="text-white/45 text-sm mb-2">Day {day} of 90 · everything stored on this device</p>

      <SectionTitle>Profile</SectionTitle>
      <div className="card divide-y divide-white/5">
        <Row icon={<User size={18} className="text-violet-400" />} label="Name">
          <input
            value={settings.name}
            onChange={(e) => updateSettings({ name: e.target.value })}
            placeholder="Your name"
            className="bg-transparent text-right focus:outline-none w-36"
          />
        </Row>
        <Row icon={<Target size={18} className="text-violet-400" />} label="Goal">
          <input
            value={settings.goalText}
            onChange={(e) => updateSettings({ goalText: e.target.value })}
            className="bg-transparent text-right focus:outline-none w-44 text-sm"
          />
        </Row>
      </div>

      <SectionTitle>Preferences</SectionTitle>
      <div className="card divide-y divide-white/5">
        <Row icon={<Scale size={18} className="text-lime" />} label="Units">
          <div className="flex gap-1 rounded-xl bg-ink-700 p-1">
            {(['kg', 'lbs'] as Units[]).map((u) => (
              <button
                key={u}
                onClick={() => updateSettings({ units: u })}
                className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
                  settings.units === u ? 'bg-lime text-ink-900' : 'text-white/50'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={<Timer size={18} className="text-lime" />} label="Default rest">
          <div className="flex gap-1 rounded-xl bg-ink-700 p-1">
            {REST_OPTIONS.map((sec) => (
              <button
                key={sec}
                onClick={() => updateSettings({ defaultRestSeconds: sec })}
                className={`px-2.5 py-1 rounded-lg text-sm font-semibold transition ${
                  settings.defaultRestSeconds === sec ? 'bg-lime text-ink-900' : 'text-white/50'
                }`}
              >
                {sec < 120 ? `${sec}s` : `${sec / 60}m`}
              </button>
            ))}
          </div>
        </Row>
      </div>

      <SectionTitle>Your Data</SectionTitle>
      <div className="card divide-y divide-white/5">
        <button onClick={() => exportData()} className="flex w-full items-center gap-3 p-4 text-left active:bg-white/5 transition">
          <Download size={18} className="text-white/60" />
          <div>
            <p className="font-medium">Export backup</p>
            <p className="text-xs text-white/40">Download all your data as JSON</p>
          </div>
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 p-4 text-left active:bg-white/5 transition">
          <Upload size={18} className="text-white/60" />
          <div>
            <p className="font-medium">Import backup</p>
            <p className="text-xs text-white/40">Restore from a JSON file</p>
          </div>
        </button>
        <button onClick={reset} className="flex w-full items-center gap-3 p-4 text-left active:bg-white/5 transition">
          <RotateCcw size={18} className="text-coral" />
          <div>
            <p className="font-medium text-coral">Reset everything</p>
            <p className="text-xs text-white/40">Wipe data and restart the 90 days</p>
          </div>
        </button>
      </div>

      <input ref={fileRef} type="file" accept="application/json" onChange={onImport} className="hidden" />

      <p className="text-center text-white/30 text-xs mt-8">Apex · 90-Day Transformation · v1.0</p>

      {busy && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/70 backdrop-blur-sm">
          <div className="card px-6 py-4 font-medium">{busy}</div>
        </div>
      )}
    </Page>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      {children}
    </div>
  );
}
