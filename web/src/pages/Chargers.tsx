import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlugZap, Search } from 'lucide-react';
import { useLive, useScoped } from '../store/live';
import { timeAgo } from '../lib/format';
import {
  ConnectorBadge,
  EmptyState,
  PageHeader,
  StateBadge,
} from '../components/ui';

export function Chargers() {
  const { chargers } = useScoped();
  const { tenants } = useLive();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const tenantName = (id: string) =>
    tenants.find((t) => t.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    return chargers
      .filter((c) =>
        filter === 'all'
          ? true
          : filter === 'online'
            ? c.state === 'Online'
            : c.state === 'Offline',
      )
      .filter((c) =>
        q
          ? `${c.id} ${c.vendor} ${c.model}`
              .toLowerCase()
              .includes(q.toLowerCase())
          : true,
      )
      .sort((a, b) => {
        if (a.state !== b.state) return a.state === 'Online' ? -1 : 1;
        return a.id.localeCompare(b.id);
      });
  }, [chargers, q, filter]);

  return (
    <>
      <PageHeader
        title="Charge Points"
        subtitle={`${chargers.length} stations · ${chargers.filter((c) => c.state === 'Online').length} online`}
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="input pl-9 sm:w-56"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="input w-auto"
            >
              <option value="all">All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No charge points"
          hint="Connect a station to ws://localhost:3000/ocpp/<id> or run the simulator."
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to={`/chargers/${c.id}`}
              className="card p-4 hover:border-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid place-items-center w-10 h-10 rounded-lg bg-ink-600/50 text-accent shrink-0">
                    <PlugZap size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate group-hover:text-accent">
                      {c.id}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {c.vendor ?? 'Unknown'} {c.model ?? ''}
                    </div>
                  </div>
                </div>
                <StateBadge online={c.state === 'Online'} />
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3 min-h-[26px]">
                {c.connectors.length === 0 ? (
                  <span className="text-xs text-slate-600">No connectors reported</span>
                ) : (
                  c.connectors.map((conn) => (
                    <span
                      key={conn.connectorId}
                      className="inline-flex items-center gap-1"
                    >
                      <span className="text-[10px] text-slate-500 font-mono">
                        C{conn.connectorId}
                      </span>
                      <ConnectorBadge status={conn.status} />
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-600/50 text-xs">
                <span className="text-slate-500">{tenantName(c.tenantId)}</span>
                <span className="flex items-center gap-2">
                  {c.protocol && (
                    <span className="px-1.5 py-0.5 rounded bg-ink-600/60 text-slate-400 font-mono">
                      OCPP {c.protocol}
                    </span>
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
