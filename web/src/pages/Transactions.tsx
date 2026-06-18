import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useScoped } from '../store/live';
import { dateTime, duration, kwh, money } from '../lib/format';
import { EmptyState, PageHeader, Stat } from '../components/ui';

export function Transactions() {
  const { transactions, currency } = useScoped();
  const [tab, setTab] = useState<'all' | 'active' | 'ended'>('all');
  const [q, setQ] = useState('');

  const totals = useMemo(() => {
    const energy = transactions.reduce((s, t) => s + t.energyWh, 0);
    const revenue = transactions.reduce((s, t) => s + (t.cost ?? 0), 0);
    return { energy, revenue, count: transactions.length };
  }, [transactions]);

  const rows = useMemo(
    () =>
      transactions
        .filter((t) =>
          tab === 'all' ? true : tab === 'active' ? t.state === 'Active' : t.state === 'Ended',
        )
        .filter((t) =>
          q
            ? `${t.chargerId} ${t.idTag ?? ''} ${t.id}`
                .toLowerCase()
                .includes(q.toLowerCase())
            : true,
        ),
    [transactions, tab, q],
  );

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Charging transactions & billing"
        actions={
          <a href="/api/transactions.csv" className="btn-ghost" download>
            Export CSV
          </a>
        }
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Stat label="Sessions" value={totals.count} />
        <Stat label="Energy" value={kwh(totals.energy)} />
        <Stat label="Revenue" value={money(totals.revenue, currency)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4">
        <div className="flex bg-ink-700 rounded-lg p-1 text-sm">
          {(['all', 'active', 'ended'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md capitalize transition-colors ${
                tab === t ? 'bg-accent text-ink-900 font-medium' : 'text-slate-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search charger, tag, id…"
          className="input sm:max-w-xs"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No sessions" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-ink-600/60">
                <th className="font-semibold px-4 py-3">Charger</th>
                <th className="font-semibold px-4 py-3">ID Tag</th>
                <th className="font-semibold px-4 py-3">Started</th>
                <th className="font-semibold px-4 py-3">Duration</th>
                <th className="font-semibold px-4 py-3">Energy</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="font-semibold px-4 py-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/40">
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-ink-700/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/chargers/${tx.chargerId}`}
                      className="text-slate-100 hover:text-accent font-medium"
                    >
                      {tx.chargerId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {tx.idTag ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{dateTime(tx.startedAt)}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {duration(tx.startedAt, tx.endedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{kwh(tx.energyWh)}</td>
                  <td className="px-4 py-3">
                    {tx.state === 'Active' ? (
                      <span className="inline-flex items-center gap-1.5 text-accent text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        Charging
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">{tx.stopReason ?? 'Ended'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-200">
                    {tx.state === 'Active'
                      ? '—'
                      : money(tx.cost, tx.currency ?? currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
