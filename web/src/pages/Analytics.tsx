import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, Gauge, Leaf, Timer, TrendingUp, Zap } from 'lucide-react';
import { useLive, useScoped } from '../store/live';
import { computeAdvanced } from '../lib/analytics';
import { kwh, money } from '../lib/format';
import { EmptyState, PageHeader, Stat } from '../components/ui';

const PIE = ['#22d3ee', '#34d399', '#a78bfa', '#f472b6', '#fbbf24', '#60a5fa'];

export function Analytics() {
  const { chargers, transactions, currency } = useScoped();
  const { tenants } = useLive();
  const m = useMemo(
    () => computeAdvanced(chargers, transactions, tenants),
    [chargers, transactions, tenants],
  );

  return (
    <>
      <PageHeader title="Analytics" subtitle="Utilization, usage patterns and sustainability" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Utilization (7d)" value={`${m.utilizationPct}%`} hint="connector busy-time" icon={<Gauge size={18} />} />
        <Stat label="Avg session" value={kwh(m.avgKwh * 1000)} hint={`${m.avgDurationMin} min average`} icon={<Timer size={18} />} />
        <Stat label="Peak power" value={`${m.peakKw} kW`} icon={<Zap size={18} />} />
        <Stat label="CO₂ avoided" value={`${m.co2Kg.toLocaleString()} kg`} hint="est. vs ICE" icon={<Leaf size={18} />} />
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
                  contentStyle={{ background: '#0f1620', border: '1px solid #1e2a3a', borderRadius: 8, fontSize: 12 }}
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
                    <Tooltip
                      contentStyle={{ background: '#0f1620', border: '1px solid #1e2a3a', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => kwh(v)}
                    />
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
      </div>
    </>
  );
}
