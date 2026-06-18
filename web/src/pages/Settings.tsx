import { useState } from 'react';
import { Check } from 'lucide-react';
import type { BrandingDTO } from '@ocpp/shared';
import { api } from '../lib/api';
import { useLive } from '../store/live';
import { PageHeader } from '../components/ui';

const PRESETS = ['#22d3ee', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#60a5fa'];

export function Settings() {
  const { branding, setBranding } = useLive();
  const [form, setForm] = useState<BrandingDTO>(branding);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const updated = await api.put<BrandingDTO>('/branding', form);
    setBranding(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="White-label branding and platform information"
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={save} className="card p-5 space-y-4">
          <h2 className="font-semibold text-white">Branding</h2>

          <label className="block">
            <span className="label">Platform name</span>
            <input
              value={form.platformName}
              onChange={(e) => setForm({ ...form, platformName: e.target.value })}
              className="input mt-1"
            />
          </label>

          <div>
            <span className="label">Accent colour</span>
            <div className="flex items-center gap-2 mt-2">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, accentColor: c })}
                  className="w-8 h-8 rounded-full grid place-items-center border-2"
                  style={{
                    background: c,
                    borderColor: form.accentColor === c ? '#fff' : 'transparent',
                  }}
                >
                  {form.accentColor === c && <Check size={14} className="text-ink-900" />}
                </button>
              ))}
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                className="w-8 h-8 rounded bg-transparent cursor-pointer"
              />
            </div>
          </div>

          <label className="block">
            <span className="label">Currency</span>
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="input mt-1 sm:max-w-[160px]"
              placeholder="USD"
            />
          </label>

          <button type="submit" className="btn-primary">
            {saved ? (
              <>
                <Check size={16} /> Saved
              </>
            ) : (
              'Save changes'
            )}
          </button>
        </form>

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-white">Connectivity</h2>
          <Info
            label="OCPP WebSocket"
            value="ws://<host>:3000/ocpp/<chargePointId>"
          />
          <Info label="Subprotocols" value="ocpp1.6, ocpp2.0.1" />
          <Info label="REST API" value="http://<host>:3000/api" />
          <Info label="Event stream" value="GET /api/events (SSE)" />
          <p className="text-xs text-slate-500 pt-2 border-t border-ink-600/50">
            Point a charge station at the WebSocket URL using its charge point id
            as the final path segment. The server negotiates OCPP 1.6 or 2.0.1
            automatically from the requested subprotocol.
          </p>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="font-mono text-sm text-slate-200 mt-1 break-all">{value}</div>
    </div>
  );
}
