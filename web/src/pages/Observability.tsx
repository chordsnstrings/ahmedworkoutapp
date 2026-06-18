import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, Plug, Timer } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, Stat } from '../components/ui';

interface MetricsSnapshot {
  uptimeSec: number;
  activeConnections: number;
  totalMessages: number;
  inbound: number;
  outbound: number;
  byKind: Record<string, number>;
  errorRatePct: number;
  messagesPerMin: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  perSecond: { s: number; count: number }[];
}

function uptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}

export function Observability() {
  const [m, setM] = useState<MetricsSnapshot | null>(null);

  useEffect(() => {
    const tick = () => api.get<MetricsSnapshot>('/metrics').then(setM).catch(() => {});
    tick();
    const i = setInterval(tick, 2000);
    return () => clearInterval(i);
  }, []);

  if (!m) return <PageHeader title="Observability" subtitle="Loading CSMS metrics…" />;

  const kinds = [
    { k: 'CALL', color: 'text-sky-300' },
    { k: 'CALLRESULT', color: 'text-emerald-300' },
    { k: 'CALLERROR', color: 'text-red-300' },
  ];

  return (
    <>
      <PageHeader title="Observability" subtitle="Live CSMS health and OCPP message metrics" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Connections" value={m.activeConnections} hint={`uptime ${uptime(m.uptimeSec)}`} icon={<Plug size={18} />} />
        <Stat label="Messages / min" value={m.messagesPerMin} hint={`${m.totalMessages} total`} icon={<Activity size={18} />} />
        <Stat label="Avg latency" value={`${m.avgLatencyMs} ms`} hint={`p95 ${m.p95LatencyMs} ms`} icon={<Timer size={18} />} />
        <Stat
          label="Error rate"
          value={`${m.errorRatePct}%`}
          hint={`${m.byKind.CALLERROR ?? 0} CALLERROR`}
          icon={<AlertTriangle size={18} />}
        />
      </div>

      <div className="card p-4 sm:p-5 mt-4">
        <h2 className="font-semibold text-white mb-4">Message throughput · last 60s</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={m.perSecond} margin={{ left: -22, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
              <XAxis dataKey="s" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} ticks={[0, 15, 30, 45, 59]} tickFormatter={(s) => `${60 - s}s`} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f1620', border: '1px solid #1e2a3a', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(s) => `${60 - (s as number)}s ago`}
                formatter={(v: number) => [v, 'msgs']}
              />
              <Bar dataKey="count" fill="#22d3ee" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-3">By message type</h2>
          <ul className="space-y-2 text-sm">
            {kinds.map(({ k, color }) => (
              <li key={k} className="flex items-center justify-between">
                <span className={`font-mono ${color}`}>{k}</span>
                <span className="text-slate-300">{(m.byKind[k] ?? 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-3">Direction</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-400">← Inbound (from chargers)</span>
              <span className="text-slate-200">{m.inbound.toLocaleString()}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-400">→ Outbound (to chargers)</span>
              <span className="text-slate-200">{m.outbound.toLocaleString()}</span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
