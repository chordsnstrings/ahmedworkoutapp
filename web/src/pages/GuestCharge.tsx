import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BatteryCharging, Check, Zap } from 'lucide-react';

/**
 * Public, no-login ad-hoc charging page. A QR sticker on the charger encodes
 * `/charge/<chargePointId>`; the driver scans it and taps Start.
 */
export function GuestCharge() {
  const { id = '' } = useParams();
  const [connectorId, setConnectorId] = useState(1);
  const [state, setState] = useState<'idle' | 'starting' | 'started' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function start() {
    setState('starting');
    setMessage('');
    try {
      const res = await fetch(`/api/public/charge/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not start');
      setState('started');
      setMessage(data.result?.status ?? 'Accepted');
    } catch (e) {
      setState('error');
      setMessage((e as Error).message);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-sm card p-6 text-center">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-accent/15 text-accent mx-auto">
          <Zap size={28} />
        </div>
        <h1 className="text-xl font-bold text-white mt-4">Start charging</h1>
        <p className="text-sm text-slate-400 mt-1">
          Station <span className="font-mono text-slate-200">{id}</span>
        </p>

        {state === 'started' ? (
          <div className="mt-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-5">
            <Check className="text-emerald-300 mx-auto" size={32} />
            <div className="text-emerald-200 font-medium mt-2">Charging started</div>
            <div className="text-xs text-slate-400 mt-1">Status: {message}</div>
          </div>
        ) : (
          <>
            <label className="block text-left mt-6">
              <span className="label">Connector</span>
              <input
                type="number"
                min={1}
                value={connectorId}
                onChange={(e) => setConnectorId(Number(e.target.value))}
                className="input mt-1"
              />
            </label>
            {state === 'error' && <p className="text-sm text-red-300 mt-3">{message}</p>}
            <button
              onClick={start}
              disabled={state === 'starting'}
              className="btn-primary w-full justify-center mt-4"
            >
              <BatteryCharging size={18} />
              {state === 'starting' ? 'Starting…' : 'Start charging'}
            </button>
            <p className="text-[11px] text-slate-500 mt-3">
              Ad-hoc session · billed at the standard tariff
            </p>
          </>
        )}
      </div>
    </div>
  );
}
