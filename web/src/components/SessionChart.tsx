import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MeterSample } from '@ocpp/shared';

/** Power (kW) area + State-of-Charge (%) line for a session's meter samples. */
export function SessionChart({ samples }: { samples?: MeterSample[] }) {
  if (!samples || samples.length < 2)
    return (
      <div className="text-xs text-slate-500 py-6 text-center">
        No telemetry captured for this session.
      </div>
    );

  const data = samples.map((s) => ({
    t: new Date(s.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    kw: Math.round((s.powerW / 1000) * 10) / 10,
    soc: s.soc,
  }));
  const hasSoc = data.some((d) => d.soc != null);

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 6 }}>
          <defs>
            <linearGradient id="sc-pwr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
          <XAxis dataKey="t" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis yAxisId="kw" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={34} />
          {hasSoc && (
            <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} stroke="#34d399" fontSize={10} tickLine={false} axisLine={false} width={30} />
          )}
          <Tooltip
            contentStyle={{ background: '#0f1620', border: '1px solid #1e2a3a', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(v: number, name) =>
              name === 'soc' ? [`${v}%`, 'SoC'] : [`${v} kW`, 'Power']
            }
          />
          <Area yAxisId="kw" type="monotone" dataKey="kw" stroke="#22d3ee" strokeWidth={2} fill="url(#sc-pwr)" />
          {hasSoc && (
            <Line yAxisId="soc" type="monotone" dataKey="soc" stroke="#34d399" strokeWidth={2} dot={false} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
