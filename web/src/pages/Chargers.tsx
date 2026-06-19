import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, List, PlugZap, Search } from 'lucide-react';
import type { ChargerDTO } from '@ocpp/shared';
import { useLive, useScoped } from '../store/live';
import { timeAgo } from '../lib/format';
import { DataTable, type Column } from '../components/DataTable';
import { ConnectorBadge, EmptyState, PageHeader, StateBadge } from '../components/ui';

type Filter = 'all' | 'online' | 'offline' | 'charging' | 'faulted';
type Sort = 'status' | 'name' | 'uptime' | 'lastSeen';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'charging', label: 'Charging' },
  { key: 'faulted', label: 'Faulted' },
];

export function Chargers() {
  const { chargers } = useScoped();
  const { tenants } = useLive();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('status');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    const match = (c: ChargerDTO) => {
      if (filter === 'online') return c.state === 'Online';
      if (filter === 'offline') return c.state === 'Offline';
      if (filter === 'charging') return c.connectors.some((x) => x.status === 'Charging');
      if (filter === 'faulted') return c.connectors.some((x) => x.status === 'Faulted');
      return true;
    };
    return chargers
      .filter(match)
      .filter((c) =>
        q ? `${c.id} ${c.vendor} ${c.model} ${c.city}`.toLowerCase().includes(q.toLowerCase()) : true,
      )
      .sort((a, b) => {
        if (sort === 'name') return a.id.localeCompare(b.id);
        if (sort === 'uptime') return (b.uptimePct ?? 0) - (a.uptimePct ?? 0);
        if (sort === 'lastSeen') return (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '');
        if (a.state !== b.state) return a.state === 'Online' ? -1 : 1;
        return a.id.localeCompare(b.id);
      });
  }, [chargers, q, filter, sort]);

  const counts = useMemo(
    () => ({
      online: chargers.filter((c) => c.state === 'Online').length,
      charging: chargers.filter((c) => c.connectors.some((x) => x.status === 'Charging')).length,
      faulted: chargers.filter((c) => c.connectors.some((x) => x.status === 'Faulted')).length,
    }),
    [chargers],
  );

  const columns: Column<ChargerDTO>[] = [
    {
      key: 'id',
      header: 'Charger',
      sortable: true,
      render: (c) => (
        <div>
          <div className="font-medium text-slate-100">{c.id}</div>
          <div className="text-xs text-slate-500">{c.vendor ?? ''} {c.model ?? ''}</div>
        </div>
      ),
    },
    { key: 'tenantId', header: 'Operator', sortable: true, render: (c) => <span className="text-slate-400">{tenantName(c.tenantId)}</span> },
    {
      key: 'state',
      header: 'Status',
      sortable: true,
      render: (c) => <StateBadge online={c.state === 'Online'} />,
    },
    {
      key: 'connectors',
      header: 'Connectors',
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.connectors.map((x) => <ConnectorBadge key={x.connectorId} status={x.status} />)}
        </div>
      ),
    },
    {
      key: 'uptimePct',
      header: 'Uptime',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.uptimePct ?? 0,
      render: (c) => <span className="text-slate-300">{c.uptimePct != null ? `${c.uptimePct}%` : '—'}</span>,
    },
    { key: 'protocol', header: 'OCPP', render: (c) => <span className="text-slate-400 font-mono text-xs">{c.protocol ?? '—'}</span> },
    {
      key: 'lastSeen',
      header: 'Last seen',
      align: 'right',
      sortable: true,
      render: (c) => <span className="text-slate-500 text-xs">{timeAgo(c.lastSeen)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Charge Points"
        subtitle={`${chargers.length} stations · ${counts.online} online · ${counts.charging} charging`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input pl-9 w-44 sm:w-56" />
            </div>
            <div className="flex bg-ink-700 rounded-lg p-1">
              <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-accent text-ink-900' : 'text-slate-400'}`} title="Grid">
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-accent text-ink-900' : 'text-slate-400'}`} title="List">
                <List size={15} />
              </button>
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-ink-700 rounded-lg p-1 text-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === f.key ? 'bg-accent text-ink-900 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
              {f.key === 'faulted' && counts.faulted > 0 && (
                <span className="ml-1 text-red-300">{counts.faulted}</span>
              )}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input w-auto text-sm ml-auto">
          <option value="status">Sort: Status</option>
          <option value="name">Sort: Name</option>
          <option value="uptime">Sort: Uptime</option>
          <option value="lastSeen">Sort: Last seen</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No charge points" hint="Connect a station to /ocpp/<id> or run the simulator." />
      ) : view === 'list' ? (
        <DataTable columns={columns} rows={filtered} rowKey={(c) => c.id} pageSize={20} onRowClick={(c) => navigate(`/chargers/${c.id}`)} />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((c) => (
            <Link key={c.id} to={`/chargers/${c.id}`} className="card p-4 hover:border-accent/50 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center w-10 h-10 rounded-lg bg-ink-600/50 text-accent shrink-0">
                    <PlugZap size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate group-hover:text-accent">{c.id}</div>
                    <div className="text-xs text-slate-500 truncate">{c.vendor ?? 'Unknown'} {c.model ?? ''}</div>
                  </div>
                </div>
                <StateBadge online={c.state === 'Online'} />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3 min-h-[26px]">
                {c.connectors.length === 0 ? (
                  <span className="text-xs text-slate-600">No connectors reported</span>
                ) : (
                  c.connectors.map((conn) => (
                    <span key={conn.connectorId} className="inline-flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-mono">C{conn.connectorId}</span>
                      <ConnectorBadge status={conn.status} />
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-600/50 text-xs">
                <span className="text-slate-500">{tenantName(c.tenantId)}</span>
                <span className="flex items-center gap-2">
                  {c.uptimePct != null && (
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono ${
                        c.uptimePct >= 99 ? 'text-emerald-300' : c.uptimePct >= 90 ? 'text-amber-300' : 'text-red-300'
                      }`}
                      title="Uptime"
                    >
                      {c.uptimePct}%
                    </span>
                  )}
                  {c.protocol && (
                    <span className="px-1.5 py-0.5 rounded bg-ink-600/60 text-slate-400 font-mono">OCPP {c.protocol}</span>
                  )}
                  <span className="text-slate-500">{timeAgo(c.lastSeen)}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
