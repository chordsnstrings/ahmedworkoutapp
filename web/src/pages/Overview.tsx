import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BatteryCharging,
  CircleDollarSign,
  PlugZap,
  Zap,
} from 'lucide-react';
import { useLive, useScoped } from '../store/live';
import { computeMetrics } from '../lib/analytics';
import { kwh, money, timeAgo } from '../lib/format';
import { PageHeader, Stat } from '../components/ui';

export function Overview() {
  const { chargers, transactions, currency } = useScoped();
  const { tenants, allTenants } = useLive();
  const m = useMemo(
    () => computeMetrics(chargers, transactions),
    [chargers, transactions],
  );

  const recent = transactions.slice(0, 6);
  const chargingNow = chargers
    .flatMap((c) => c.connectors.map((conn) => ({ charger: c, conn })))
    .filter((x) => x.conn.status === 'Charging');

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Network health and energy at a glance"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat
          label="Chargers online"
          value={`${m.chargersOnline}/${m.chargersTotal}`}
          hint={`${m.connectorsCharging} connectors charging`}
          icon={<PlugZap size={18} />}
        />
        <Stat
          label="Active sessions"
          value={m.sessionsActive}
          hint={`${m.sessionsToday} started today`}
          icon={<BatteryCharging size={18} />}
        />
        <Stat
          label="Energy today"
          value={kwh(m.energyTodayWh)}
          hint={`${kwh(m.energyTotalWh)} all time`}
          icon={<Zap size={18} />}
        />
        <Stat
          label="Revenue today"
          value={money(m.revenueToday, currency)}
          hint={`${money(m.revenueTotal, currency)} all time`}
          icon={<CircleDollarSign size={18} />}
        />
      </div>

      <div className="card p-4 sm:p-5 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Energy & revenue · 14 days</h2>
          <div className="text-xs text-slate-400">
            {allTenants ? 'All operators' : 'Selected operator'}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={m.byDay} margin={{ left: -16, right: 8 }}>
              <defs>
                <linearGradient id="g-energy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f1620',
                  border: '1px solid #1e2a3a',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: number, name) =>
                  name === 'energyWh'
                    ? [kwh(value), 'Energy']
                    : [money(value, currency), 'Revenue']
                }
              />
              <Area
                type="monotone"
                dataKey="energyWh"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#g-energy)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* Charging now */}
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-3">Charging now</h2>
          {chargingNow.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No active charging sessions.
            </p>
          ) : (
            <ul className="divide-y divide-ink-600/50">
              {chargingNow.map(({ charger, conn }) => (
                <li
                  key={`${charger.id}-${conn.connectorId}`}
                  className="flex items-center justify-between py-2.5"
                >
                  <Link
                    to={`/chargers/${charger.id}`}
                    className="font-medium text-slate-100 hover:text-accent"
                  >
                    {charger.id}
                    <span className="text-slate-500 font-normal">
                      {' '}
                      · C{conn.connectorId}
                    </span>
                  </Link>
                  <span className="text-sm text-accent font-mono">
                    {conn.powerW ? `${(conn.powerW / 1000).toFixed(1)} kW` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent sessions */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Recent sessions</h2>
            <Link to="/transactions" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No sessions yet.</p>
          ) : (
            <ul className="divide-y divide-ink-600/50">
              {recent.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100 truncate">
                      {tx.chargerId}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tx.idTag ?? 'anonymous'} · {timeAgo(tx.startedAt)}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="text-sm text-slate-200">{kwh(tx.energyWh)}</div>
                    <div className="text-xs text-slate-500">
                      {tx.state === 'Active' ? (
                        <span className="text-accent">charging…</span>
                      ) : (
                        money(tx.cost, tx.currency ?? currency)
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Operator breakdown (only in all-operators view) */}
      {allTenants && tenants.length > 0 && (
        <div className="card p-4 sm:p-5 mt-4">
          <h2 className="font-semibold text-white mb-3">By operator</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tenants.map((t) => {
              const list = chargers.filter((c) => c.tenantId === t.id);
              const online = list.filter((c) => c.state === 'Online').length;
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-ink-600/60 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: t.accentColor }}
                    />
                    <span className="font-medium text-slate-100 truncate">
                      {t.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">
                    {list.length} CP · {online} up
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
