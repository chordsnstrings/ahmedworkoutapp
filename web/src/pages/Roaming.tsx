import { useEffect, useState } from 'react';
import { Copy, Globe, Plus, Trash2 } from 'lucide-react';
import type { RoamingInfoDTO, RoamingPartnerDTO } from '@ocpp/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { EmptyState, PageHeader, Stat } from '../components/ui';

interface Cdr {
  id: string;
  total_energy: number;
  total_cost: { incl_vat: number };
  currency: string;
  start_date_time: string;
  cdr_location: { id: string };
}

export function Roaming() {
  const { can } = useAuth();
  const [info, setInfo] = useState<RoamingInfoDTO | null>(null);
  const [partners, setPartners] = useState<RoamingPartnerDTO[]>([]);
  const [cdrs, setCdrs] = useState<Cdr[]>([]);
  const [form, setForm] = useState({ name: '', role: 'EMSP', countryCode: 'DE', partyId: 'EMP' });

  async function load() {
    const [i, p, c] = await Promise.all([
      api.get<RoamingInfoDTO>('/roaming/info'),
      api.get<RoamingPartnerDTO[]>('/roaming/partners'),
      api.get<Cdr[]>('/roaming/cdrs'),
    ]);
    setInfo(i);
    setPartners(p);
    setCdrs(c);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post('/roaming/partners', form);
    setForm({ name: '', role: 'EMSP', countryCode: 'DE', partyId: 'EMP' });
    await load();
  }

  return (
    <>
      <PageHeader
        title="Roaming (OCPI 2.2.1)"
        subtitle="Share locations and CDRs with eMSPs and roaming hubs"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Stat label="Locations" value={info?.locations ?? '—'} icon={<Globe size={18} />} />
        <Stat label="Sessions shared" value={info?.sessions ?? '—'} />
        <Stat label="CDRs" value={info?.cdrs ?? '—'} />
        <Stat label="Partners" value={info?.partners ?? '—'} />
      </div>

      <div className="card p-4 sm:p-5 mb-4">
        <h2 className="font-semibold text-white mb-3">Your OCPI endpoints</h2>
        <div className="space-y-2">
          <EndpointRow label="Party" value={`${info?.countryCode}*${info?.partyId}`} />
          <EndpointRow label="Versions URL" value={info?.versionsUrl ?? ''} copyable />
          <EndpointRow label="Version 2.2.1" value={info?.versionDetailUrl ?? ''} copyable />
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Register a partner below to mint a token they present as
          <span className="font-mono"> Authorization: Token …</span> when calling these endpoints.
        </p>
      </div>

      {can('operator') && (
        <form onSubmit={add} className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <label className="block col-span-2 sm:col-span-1">
            <span className="label">Partner name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input mt-1" placeholder="GreenFlux" />
          </label>
          <label className="block">
            <span className="label">Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input mt-1">
              <option value="EMSP">eMSP</option>
              <option value="HUB">Hub</option>
              <option value="CPO">CPO</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Country</span>
            <input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Party ID</span>
            <input value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} className="input mt-1" />
          </label>
          <button type="submit" className="btn-primary justify-center">
            <Plus size={16} /> Register
          </button>
        </form>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-3">Partners</h2>
          {partners.length === 0 ? (
            <p className="text-sm text-slate-500">No roaming partners yet.</p>
          ) : (
            <ul className="space-y-2">
              {partners.map((p) => (
                <li key={p.id} className="rounded-lg border border-ink-600/60 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-100">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.role} · {p.countryCode}*{p.partyId}
                      </div>
                    </div>
                    {can('operator') && (
                      <button onClick={() => api.del(`/roaming/partners/${p.id}`).then(load)} className="btn-danger py-1 px-2">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-[11px] text-accent bg-ink-900/60 rounded px-2 py-1 truncate flex-1">
                      Token {p.tokenIn}
                    </code>
                    <button
                      onClick={() => navigator.clipboard?.writeText(p.tokenIn)}
                      className="text-slate-500 hover:text-white"
                      title="Copy token"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-3">Recent CDRs</h2>
          {cdrs.length === 0 ? (
            <EmptyState title="No CDRs" />
          ) : (
            <div className="max-h-80 overflow-y-auto -mx-1">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-ink-600/40">
                  {cdrs.slice(0, 30).map((c) => (
                    <tr key={c.id}>
                      <td className="px-1 py-2 font-mono text-xs text-slate-400">{c.id}</td>
                      <td className="px-1 py-2 text-slate-300">{c.cdr_location.id}</td>
                      <td className="px-1 py-2 text-slate-400">{c.total_energy.toFixed(1)} kWh</td>
                      <td className="px-1 py-2 text-right text-slate-200">
                        {c.total_cost.incl_vat.toFixed(2)} {c.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function EndpointRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="label shrink-0">{label}</span>
      <span className="flex items-center gap-2 min-w-0">
        <code className="text-xs text-slate-300 font-mono truncate">{value}</code>
        {copyable && (
          <button onClick={() => navigator.clipboard?.writeText(value)} className="text-slate-500 hover:text-white shrink-0">
            <Copy size={13} />
          </button>
        )}
      </span>
    </div>
  );
}
