import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Wrench } from 'lucide-react';
import type { TicketDTO, TicketStatus } from '@ocpp/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useScoped } from '../store/live';
import { dateTime } from '../lib/format';
import { EmptyState, PageHeader, Stat } from '../components/ui';

const STATUS: { key: TicketStatus; label: string; style: string }[] = [
  { key: 'open', label: 'Open', style: 'bg-red-500/15 text-red-300' },
  { key: 'in_progress', label: 'In progress', style: 'bg-amber-500/15 text-amber-300' },
  { key: 'resolved', label: 'Resolved', style: 'bg-emerald-500/15 text-emerald-300' },
];
const NEXT: Record<TicketStatus, TicketStatus> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'open',
};

export function Maintenance() {
  const { can } = useAuth();
  const { chargers } = useScoped();
  const inScope = new Set(chargers.map((c) => c.id));
  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [form, setForm] = useState({ chargerId: '', title: '' });

  async function load() {
    const t = await api.get<TicketDTO[]>('/tickets');
    setTickets(t.filter((x) => inScope.has(x.chargerId)));
  }
  useEffect(() => {
    void load();
    const i = setInterval(load, 6000);
    return () => clearInterval(i);
  }, [chargers.length]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const chargerId = form.chargerId || chargers[0]?.id;
    if (!chargerId || !form.title.trim()) return;
    await api.post('/tickets', { chargerId, title: form.title });
    setForm({ chargerId: '', title: '' });
    await load();
  }

  const rows = tickets.filter((t) => (filter === 'all' ? true : t.status === filter));
  const open = tickets.filter((t) => t.status !== 'resolved').length;

  return (
    <>
      <PageHeader title="Maintenance" subtitle="Tickets and charger lifecycle" />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Stat label="Open tickets" value={open} icon={<Wrench size={18} />} />
        <Stat label="In progress" value={tickets.filter((t) => t.status === 'in_progress').length} />
        <Stat label="Resolved" value={tickets.filter((t) => t.status === 'resolved').length} />
      </div>

      {can('operator') && (
        <form onSubmit={add} className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <label className="block">
            <span className="label">Charger</span>
            <select value={form.chargerId} onChange={(e) => setForm({ ...form, chargerId: e.target.value })} className="input mt-1">
              {chargers.map((c) => (
                <option key={c.id} value={c.id}>{c.id}</option>
              ))}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="label">Issue</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input mt-1" placeholder="Connector 2 not latching" />
          </label>
          <button type="submit" className="btn-primary justify-center">
            <Plus size={16} /> Raise ticket
          </button>
        </form>
      )}

      <div className="flex bg-ink-700 rounded-lg p-1 text-sm mb-4 w-fit">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-md capitalize transition-colors ${
              filter === t ? 'bg-accent text-ink-900 font-medium' : 'text-slate-400'
            }`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No tickets" hint="Critical faults open tickets automatically." />
      ) : (
        <div className="card divide-y divide-ink-600/40">
          {rows.map((t) => {
            const s = STATUS.find((x) => x.key === t.status)!;
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-slate-100">{t.title}</div>
                  <div className="text-xs text-slate-500">
                    <Link to={`/chargers/${t.chargerId}`} className="hover:text-accent">{t.chargerId}</Link>
                    {' · '}{t.type}{' · '}{dateTime(t.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.style}`}>{s.label}</span>
                  {can('operator') && (
                    <>
                      <button
                        onClick={() => api.put(`/tickets/${t.id}`, { ...t, status: NEXT[t.status] }).then(load)}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        {t.status === 'resolved' ? 'Reopen' : t.status === 'open' ? 'Start' : 'Resolve'}
                      </button>
                      <button onClick={() => api.del(`/tickets/${t.id}`).then(load)} className="btn-danger py-1 px-2">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
