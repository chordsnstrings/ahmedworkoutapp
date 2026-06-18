import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Receipt } from 'lucide-react';
import type { InvoiceDTO } from '@ocpp/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useLive } from '../store/live';
import { ALL_TENANTS } from '../store/live';
import { dateTime, money } from '../lib/format';
import { EmptyState, PageHeader, Stat } from '../components/ui';

export function Payments() {
  const { can } = useAuth();
  const { tenantId, branding } = useLive();
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setInvoices(await api.get<InvoiceDTO[]>('/invoices'));
  }
  useEffect(() => {
    void load();
  }, []);

  const scoped = useMemo(
    () =>
      tenantId === ALL_TENANTS
        ? invoices
        : invoices.filter((i) => i.tenantId === tenantId),
    [invoices, tenantId],
  );

  const totals = useMemo(() => {
    const paid = scoped.filter((i) => i.status === 'paid');
    const pending = scoped.filter((i) => i.status === 'pending');
    return {
      collected: paid.reduce((s, i) => s + i.amount, 0),
      outstanding: pending.reduce((s, i) => s + i.amount, 0),
      pendingCount: pending.length,
    };
  }, [scoped]);

  async function pay(inv: InvoiceDTO) {
    setBusy(inv.id);
    try {
      await api.post(`/payments/checkout/${inv.id}`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle="Invoices, settlement and collection" />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Stat label="Collected" value={money(totals.collected, branding.currency)} />
        <Stat
          label="Outstanding"
          value={money(totals.outstanding, branding.currency)}
          hint={`${totals.pendingCount} unpaid`}
        />
        <Stat label="Invoices" value={scoped.length} />
      </div>

      {scoped.length === 0 ? (
        <EmptyState title="No invoices" hint="Invoices are generated when paid sessions end." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-ink-600/60">
                <th className="font-semibold px-4 py-3">Invoice</th>
                <th className="font-semibold px-4 py-3">Charger</th>
                <th className="font-semibold px-4 py-3">Date</th>
                <th className="font-semibold px-4 py-3">Amount</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="font-semibold px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/40">
              {scoped.map((inv) => (
                <tr key={inv.id} className="hover:bg-ink-700/40">
                  <td className="px-4 py-3 font-mono text-slate-200 flex items-center gap-2">
                    <Receipt size={14} className="text-slate-500" />
                    {inv.number}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/chargers/${inv.chargerId}`} className="text-slate-300 hover:text-accent">
                      {inv.chargerId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{dateTime(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-200">{money(inv.amount, inv.currency)}</td>
                  <td className="px-4 py-3">
                    {inv.status === 'paid' ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                        Paid{inv.method ? ` · ${inv.method}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {inv.status === 'pending' && can('operator') && (
                      <button
                        onClick={() => pay(inv)}
                        disabled={busy === inv.id}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        <CreditCard size={14} /> Collect
                      </button>
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
