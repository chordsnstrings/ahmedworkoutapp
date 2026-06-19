import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TransactionDTO } from '@ocpp/shared';
import { useScoped } from '../store/live';
import { dateTime, duration, kwh, money } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, PageHeader, Stat } from '../components/ui';

export function Transactions() {
  const { transactions, currency } = useScoped();
  const navigate = useNavigate();
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
            ? `${t.chargerId} ${t.idTag ?? ''} ${t.id}`.toLowerCase().includes(q.toLowerCase())
            : true,
        ),
    [transactions, tab, q],
  );

  const columns: Column<TransactionDTO>[] = [
    {
      key: 'chargerId',
      header: 'Charger',
      sortable: true,
      render: (t) => <span className="text-slate-100 font-medium">{t.chargerId}</span>,
    },
    {
      key: 'idTag',
      header: 'ID Tag',
      render: (t) => <span className="text-slate-400 font-mono text-xs">{t.idTag ?? '—'}</span>,
    },
    {
      key: 'startedAt',
      header: 'Started',
      sortable: true,
      render: (t) => <span className="text-slate-400">{dateTime(t.startedAt)}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      sortValue: (t) => (t.endedAt ? Date.parse(t.endedAt) : Date.now()) - Date.parse(t.startedAt),
      sortable: true,
      render: (t) => <span className="text-slate-400">{duration(t.startedAt, t.endedAt)}</span>,
    },
    {
      key: 'energyWh',
      header: 'Energy',
      align: 'right',
      sortable: true,
      render: (t) => <span className="text-slate-200">{kwh(t.energyWh)}</span>,
    },
    {
      key: 'soc',
      header: 'SoC',
      align: 'right',
      sortable: true,
      render: (t) => <span className="text-slate-400">{t.soc != null ? `${t.soc}%` : '—'}</span>,
    },
    {
      key: 'state',
      header: 'Status',
      render: (t) =>
        t.state === 'Active' ? (
          <span className="inline-flex items-center gap-1.5 text-accent text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Charging
          </span>
        ) : (
          <span className="text-slate-500 text-xs">{t.stopReason ?? 'Ended'}</span>
        ),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.cost ?? 0,
      render: (t) => (
        <span className="text-slate-200">
          {t.state === 'Active' ? '—' : money(t.cost, t.currency ?? currency)}
        </span>
      ),
    },
  ];

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

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(t) => t.id}
        pageSize={25}
        initialSort={{ key: 'startedAt', dir: 'desc' }}
        onRowClick={(t) => navigate(`/chargers/${t.chargerId}`)}
        empty={<EmptyState title="No sessions" />}
      />
    </>
  );
}
