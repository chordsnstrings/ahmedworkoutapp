import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { EmptyState, PageHeader } from '../components/ui';

interface AuditEntry {
  id: string;
  at: string;
  user: string;
  role: string;
  action: string;
  target: string;
}

const ROLE_STYLE: Record<string, string> = {
  admin: 'text-violet-300',
  operator: 'text-accent',
  viewer: 'text-slate-400',
};

export function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    void api.get<AuditEntry[]>('/audit').then(setEntries);
  }, []);

  const rows = entries.filter((e) =>
    q ? `${e.user} ${e.action} ${e.target}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Every operator action that changed platform state"
        actions={
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by user or action…"
            className="input sm:w-64"
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No audit entries yet" hint="Mutating actions are recorded here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-ink-600/60">
                <th className="font-semibold px-4 py-3">Time</th>
                <th className="font-semibold px-4 py-3">User</th>
                <th className="font-semibold px-4 py-3">Role</th>
                <th className="font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/40">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-ink-700/40">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{dateTime(e.at)}</td>
                  <td className="px-4 py-3 text-slate-200 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-slate-500" />
                    {e.user}
                  </td>
                  <td className={`px-4 py-3 capitalize ${ROLE_STYLE[e.role] ?? 'text-slate-400'}`}>
                    {e.role}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {e.action}
                    {e.target && <span className="text-slate-500"> · {e.target}</span>}
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
