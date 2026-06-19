import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarRange, Clock, Gauge, Leaf, Timer, TrendingUp, Zap } from 'lucide-react';
import { useLive, useScoped } from '../store/live';
import { computeAdvanced } from '../lib/analytics';
import { kwh, money } from '../lib/format';
import { EmptyState, PageHeader, Stat } from '../components/ui';

const PIE = ['#22d3ee', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#60a5fa'];
const RANGES: { days: number; label: string }[] = [
  { days: 7, label: '7d' },
  { days: 14, label: '14d' },
  { days: 30, label: '30d' },
];
const tooltipStyle = {
  background: '#0f1620',
  border: '1px solid #1e2a3a',
  borderRadius: 8,
  fontSize: 12,
};

export function Analytics() {
  const { chargers, transactions, currency } = useScoped();
  const { tenants } = useLive();
  const [range, setRange] = useState(14);
  const m = useMemo(
    () => computeAdvanced(chargers, transactions, tenants, range),
    [chargers, transactions, tenants, range],
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Utilization, usage patterns and sustainability"
        actions={
          <div className="flex items-center gap-2 bg-ink-700 rounded-lg p-1 text-sm">
            <CalendarRange size={15} className="text-slate-500 ml-1.5" />
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  range === r.days ? 'bg-accent text-ink-900 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label={`Utilization (${m.rangeDays}d)`} value={`${m.utilizationPct}%`} hint="connector busy-time" icon={<Gauge size={18} />} />
        <Stat label="Avg session" value={kwh(m.avgKwh * 1000)} hint={`${m.avgDurationMin} min · ${m.sessions} sessions`} icon={<Timer size={18} />} />
        <Stat label="Peak power" value={`${m.peakKw} kW`} icon={<Zap size={18} />} />
        <Stat label="CO₂ avoided" value={`${m.co2Kg.toLocaleString()} kg`} hint="est. vs ICE" icon={<Leaf size={18} />} />
      </div>

      <div className="card p-4 sm:p-5 mt-4">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-accent" /> Energy &amp; revenue · last {m.rangeDays} days
        </h2>
        {m.byDay.every((d) => d.energyWh === 0) ? (
          <EmptyState title="No sessions in range" hint="Widen the range or connect a station." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={m.byDay} margin={{ left: -10, right: 8 }}>
                <defs>
                  <linearGradient id="enFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false}
                  interval={Math.max(0, Math.floor(m.byDay.length / 10))} />
                <YAxis yAxisId="e" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => kwh(v as number)} width={56} />
                <YAxis yAxisId="r" orientation="right" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => money(v as number, currency)} width={56} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number, n) =>
                    n === 'revenue' ? [money(v, currency), 'Revenue'] : [kwh(v), 'Energy']
                  }
                />
                <Area yAxisId="e" dataKey="energyWh" stroke="#22d3ee" strokeWidth={2} fill="url(#enFill)" />
                <Line yAxisId="r" dataKey="revenue" stroke="#34d399" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-accent" /> Sessions by hour of day
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.byHour} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number, n) => (n === 'energyWh' ? [kwh(v), 'Energy'] : [v, 'Sessions'])}
                  labelFormatter={(l) => `${l}:00`}
                />
                <Bar dataKey="sessions" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <CalendarRange size={16} className="text-accent" /> Sessions by day of week
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.byWeekday} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: number, n) => (n === 'energyWh' ? [kwh(v), 'Energy'] : [v, 'Sessions'])}
                />
                <Bar dataKey="sessions" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-4 sm:p-5 mt-4">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-accent" /> Energy by operator
        </h2>
        {m.byOperator.length === 0 ? (
          <EmptyState title="No data" />
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={m.byOperator} dataKey="energyWh" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                    {m.byOperator.map((_, i) => (
                      <Cell key={i} fill={PIE[i % PIE.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => kwh(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 w-full space-y-2">
              {m.byOperator.map((o, i) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE[i % PIE.length] }} />
                    <span className="text-slate-200 truncate">{o.name}</span>
                  </span>
                  <span className="text-slate-400 shrink-0 ml-3">
                    {kwh(o.energyWh)} · {money(o.revenue, currency)} · {o.sessions}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
