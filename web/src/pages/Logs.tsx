import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useScoped } from '../store/live';
import { EmptyState, PageHeader } from '../components/ui';

const KIND_STYLE: Record<string, string> = {
  CALL: 'text-sky-300',
  CALLRESULT: 'text-emerald-300',
  CALLERROR: 'text-red-300',
};

type Dir = 'all' | 'in' | 'out';
type Kind = 'all' | 'CALL' | 'CALLRESULT' | 'CALLERROR';

const DIRS: { key: Dir; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'Inbound' },
  { key: 'out', label: 'Outbound' },
];
const KINDS: Kind[] = ['all', 'CALL', 'CALLRESULT', 'CALLERROR'];

export function Logs() {
  const { logs } = useScoped();
  const [q, setQ] = useState('');
  const [dir, setDir] = useState<Dir>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const summary = useMemo(() => {
    let inbound = 0;
    let errors = 0;
    for (const l of logs) {
      if (l.direction === 'in') inbound++;
      if (l.kind === 'CALLERROR') errors++;
    }
    return { total: logs.length, inbound, outbound: logs.length - inbound, errors };
  }, [logs]);

  const rows = useMemo(
    () =>
      logs.filter((l) => {
        if (dir !== 'all' && l.direction !== dir) return false;
        if (kind !== 'all' && l.kind !== kind) return false;
        return q
          ? `${l.chargerId} ${l.action} ${l.kind}`.toLowerCase().includes(q.toLowerCase())
          : true;
      }),
    [logs, q, dir, kind],
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

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-ink-700 rounded-lg p-1 text-sm">
          {DIRS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDir(d.key)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                dir === d.key ? 'bg-accent text-ink-900 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex bg-ink-700 rounded-lg p-1 text-sm">
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-2.5 py-1 rounded-md transition-colors font-mono text-xs ${
                kind === k ? 'bg-accent text-ink-900 font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {k === 'all' ? 'All' : k}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          <span className="text-cyan-400">↓ {summary.inbound.toLocaleString()}</span>
          <span className="text-violet-400">↑ {summary.outbound.toLocaleString()}</span>
          {summary.errors > 0 && <span className="text-red-300">{summary.errors} errors</span>}
          <span className="tabular-nums">{rows.length.toLocaleString()} shown</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No messages match"
          hint={logs.length ? 'Adjust the filters above.' : 'Messages appear here as charge points communicate.'}
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
