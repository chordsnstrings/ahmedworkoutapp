import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { DataTable } from '../components/DataTable';
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

      <DataTable
        columns={[
          {
            key: 'at',
            header: 'Time',
            sortable: true,
            render: (e) => <span className="text-slate-400 whitespace-nowrap">{dateTime(e.at)}</span>,
          },
          {
            key: 'user',
            header: 'User',
            sortable: true,
            render: (e) => (
              <span className="text-slate-200 inline-flex items-center gap-2">
                <ShieldCheck size={14} className="text-slate-500" />
                {e.user}
              </span>
            ),
          },
          {
            key: 'role',
            header: 'Role',
            sortable: true,
            render: (e) => (
              <span className={`capitalize ${ROLE_STYLE[e.role] ?? 'text-slate-400'}`}>{e.role}</span>
            ),
          },
          {
            key: 'action',
            header: 'Action',
            render: (e) => (
              <span className="font-mono text-xs text-slate-300">
                {e.action}
                {e.target && <span className="text-slate-500"> · {e.target}</span>}
              </span>
            ),
          },
        ]}
        rows={rows}
        rowKey={(e) => e.id}
        initialSort={{ key: 'at', dir: 'desc' }}
        empty={<EmptyState title="No audit entries yet" hint="Mutating actions are recorded here." />}
      />
    </>
  );
}
