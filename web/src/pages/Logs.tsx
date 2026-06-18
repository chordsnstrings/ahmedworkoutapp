import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useScoped } from '../store/live';
import { EmptyState, PageHeader } from '../components/ui';

const KIND_STYLE: Record<string, string> = {
  CALL: 'text-sky-300',
  CALLRESULT: 'text-emerald-300',
  CALLERROR: 'text-red-300',
};

export function Logs() {
  const { logs } = useScoped();
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      logs.filter((l) =>
        q
          ? `${l.chargerId} ${l.action} ${l.kind}`.toLowerCase().includes(q.toLowerCase())
          : true,
      ),
    [logs, q],
  );

  return (
    <>
      <PageHeader
        title="Live OCPP Log"
        subtitle="Realtime wire messages between the CSMS and charge points"
        actions={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by charger or action…"
            className="input sm:w-64"
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No messages yet"
          hint="Messages appear here as charge points communicate."
        />
      ) : (
        <div className="card divide-y divide-ink-600/40 font-mono text-xs overflow-hidden">
          {rows.slice(0, 300).map((l) => (
            <div key={l.id}>
              <button
                onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                className="w-full flex items-center gap-3 px-3 sm:px-4 py-2 hover:bg-ink-700/40 text-left"
              >
                <span className="text-slate-600 hidden sm:inline shrink-0">
                  {new Date(l.at).toLocaleTimeString()}
                </span>
                <span
                  className={`shrink-0 ${
                    l.direction === 'in' ? 'text-cyan-400' : 'text-violet-400'
                  }`}
                  title={l.direction === 'in' ? 'from charger' : 'to charger'}
                >
                  {l.direction === 'in' ? (
                    <ArrowDownLeft size={14} />
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
                </span>
                <span className="text-slate-300 truncate w-28 sm:w-40 shrink-0">
                  {l.chargerId}
                </span>
                <span className={`shrink-0 w-20 ${KIND_STYLE[l.kind] ?? 'text-slate-400'}`}>
                  {l.kind}
                </span>
                <span className="text-slate-100 font-sans font-medium truncate">
                  {l.action || '—'}
                </span>
              </button>
              {expanded === l.id && (
                <pre className="px-4 py-3 bg-ink-900/60 text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(l.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
