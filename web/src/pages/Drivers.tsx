import { useEffect, useState } from 'react';
import { Plus, Trash2, Wallet } from 'lucide-react';
import type { DriverDTO, TokenDTO, WalletEntryDTO } from '@ocpp/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { dateTime, money } from '../lib/format';
import { EmptyState, PageHeader, Stat } from '../components/ui';

export function Drivers() {
  const { can } = useAuth();
  const [drivers, setDrivers] = useState<DriverDTO[]>([]);
  const [tokens, setTokens] = useState<TokenDTO[]>([]);
  const [ledger, setLedger] = useState<Record<string, WalletEntryDTO[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', balance: 25 });

  async function load() {
    const [d, t] = await Promise.all([
      api.get<DriverDTO[]>('/drivers'),
      api.get<TokenDTO[]>('/tokens'),
    ]);
    setDrivers(d);
    setTokens(t);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post('/drivers', { name: form.name, email: form.email, balance: Number(form.balance), tokenIds: [] });
    setForm({ name: '', email: '', balance: 25 });
    await load();
  }

  async function toggleToken(d: DriverDTO, idTag: string) {
    const tokenIds = d.tokenIds.includes(idTag)
      ? d.tokenIds.filter((x) => x !== idTag)
      : [...d.tokenIds, idTag];
    await api.put(`/drivers/${d.id}`, { ...d, tokenIds });
    await load();
  }

  async function expand(d: DriverDTO) {
    if (open === d.id) return setOpen(null);
    setOpen(d.id);
    const w = await api.get<WalletEntryDTO[]>(`/drivers/${d.id}/wallet`);
    setLedger((l) => ({ ...l, [d.id]: w }));
  }

  const totalBalance = drivers.reduce((s, d) => s + d.balance, 0);
  const currency = drivers[0]?.currency ?? 'USD';

  return (
    <>
      <PageHeader title="Drivers & Wallets" subtitle="Driver accounts, prepaid balances and RFID links" />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Stat label="Drivers" value={drivers.length} />
        <Stat label="Wallet float" value={money(totalBalance, currency)} icon={<Wallet size={18} />} />
        <Stat label="Linked tokens" value={drivers.reduce((s, d) => s + d.tokenIds.length, 0)} />
      </div>

      {can('operator') && (
        <form onSubmit={add} className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <label className="block">
            <span className="label">Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Starting balance</span>
            <input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })} className="input mt-1" />
          </label>
          <button type="submit" className="btn-primary justify-center">
            <Plus size={16} /> Add driver
          </button>
        </form>
      )}

      {drivers.length === 0 ? (
        <EmptyState title="No drivers" />
      ) : (
        <div className="space-y-3">
          {drivers.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{d.name}</div>
                  <div className="text-xs text-slate-500">{d.email ?? '—'}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${d.balance < 0 ? 'text-red-300' : 'text-white'}`}>
                    {money(d.balance, d.currency)}
                  </div>
                  <div className="text-xs text-slate-500">balance</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {tokens.map((t) => {
                  const on = d.tokenIds.includes(t.idTag);
                  return (
                    <button
                      key={t.idTag}
                      disabled={!can('operator')}
                      onClick={() => toggleToken(d, t.idTag)}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                        on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600/60 text-slate-500'
                      } disabled:opacity-60`}
                    >
                      {t.idTag}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-2">
                {can('operator') && (
                  <>
                    <TopUp onTopUp={(amt) => api.post(`/drivers/${d.id}/topup`, { amount: amt }).then(load)} />
                    <button onClick={() => api.del(`/drivers/${d.id}`).then(load)} className="btn-danger py-1.5 px-2">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button onClick={() => expand(d)} className="btn-ghost py-1.5 px-3 text-xs ml-auto">
                  {open === d.id ? 'Hide' : 'Wallet history'}
                </button>
              </div>

              {open === d.id && (
                <ul className="mt-3 border-t border-ink-600/50 pt-3 space-y-1.5 text-sm max-h-48 overflow-y-auto">
                  {(ledger[d.id] ?? []).length === 0 ? (
                    <li className="text-xs text-slate-500">No wallet activity.</li>
                  ) : (
                    (ledger[d.id] ?? []).map((w) => (
                      <li key={w.id} className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">
                          {dateTime(w.at)} · {w.reference}
                        </span>
                        <span className={w.amount < 0 ? 'text-red-300' : 'text-emerald-300'}>
                          {w.amount < 0 ? '' : '+'}
                          {money(w.amount, d.currency)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TopUp({ onTopUp }: { onTopUp: (amount: number) => void }) {
  const [amt, setAmt] = useState(20);
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={amt}
        onChange={(e) => setAmt(Number(e.target.value))}
        className="input py-1.5 w-20 text-sm"
      />
      <button onClick={() => onTopUp(amt)} className="btn-ghost py-1.5 px-3 text-xs">
        <Wallet size={14} /> Top up
      </button>
    </div>
  );
}
