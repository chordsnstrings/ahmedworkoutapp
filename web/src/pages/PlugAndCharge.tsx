import { useEffect, useState } from 'react';
import { BadgeCheck, Plus, Trash2 } from 'lucide-react';
import type { ContractCertificateDTO, ContractStatus } from '@ocpp/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { dateTime } from '../lib/format';
import { EmptyState, PageHeader } from '../components/ui';

const STATUS_STYLE: Record<ContractStatus, string> = {
  Valid: 'bg-emerald-500/15 text-emerald-300',
  Revoked: 'bg-red-500/15 text-red-300',
  Expired: 'bg-amber-500/15 text-amber-300',
};

export function PlugAndCharge() {
  const { can } = useAuth();
  const [contracts, setContracts] = useState<ContractCertificateDTO[]>([]);
  const [emaid, setEmaid] = useState('');
  const [holder, setHolder] = useState('');

  async function load() {
    setContracts(await api.get<ContractCertificateDTO[]>('/contracts'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!emaid.trim()) return;
    await api.post('/contracts', { emaid: emaid.trim(), holder: holder.trim() || 'Unnamed' });
    setEmaid('');
    setHolder('');
    await load();
  }

  async function setStatus(c: ContractCertificateDTO, status: ContractStatus) {
    await api.put(`/contracts/${encodeURIComponent(c.emaid)}`, { ...c, status });
    await load();
  }

  return (
    <>
      <PageHeader
        title="Plug & Charge (ISO 15118)"
        subtitle="Contract certificates that authorise automatic, cable-only charging"
      />

      {can('operator') && (
        <form onSubmit={add} className="card p-4 mb-4 flex flex-col sm:flex-row gap-2">
          <input
            value={emaid}
            onChange={(e) => setEmaid(e.target.value)}
            placeholder="eMAID (e.g. DE-8AA-CA12B34-9)"
            className="input sm:max-w-xs font-mono"
          />
          <input
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="Holder / vehicle"
            className="input sm:max-w-xs"
          />
          <button type="submit" className="btn-primary justify-center">
            <Plus size={16} /> Add contract
          </button>
        </form>
      )}

      {contracts.length === 0 ? (
        <EmptyState
          title="No contracts"
          hint="Add an eMAID so a vehicle can authenticate by plugging in."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-ink-600/60">
                <th className="font-semibold px-4 py-3">eMAID</th>
                <th className="font-semibold px-4 py-3">Holder</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="font-semibold px-4 py-3">Added</th>
                <th className="font-semibold px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/40">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-ink-700/40">
                  <td className="px-4 py-3 font-mono text-slate-100 flex items-center gap-2">
                    <BadgeCheck size={15} className="text-accent" />
                    {c.emaid}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.holder}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{dateTime(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    {can('operator') && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setStatus(c, c.status === 'Revoked' ? 'Valid' : 'Revoked')}
                          className="btn-ghost py-1 px-2 text-xs"
                        >
                          {c.status === 'Revoked' ? 'Restore' : 'Revoke'}
                        </button>
                        <button
                          onClick={() => api.del(`/contracts/${encodeURIComponent(c.emaid)}`).then(load)}
                          className="btn-danger py-1 px-2"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
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
