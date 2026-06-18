import { Download, FileSpreadsheet } from 'lucide-react';
import { useScoped } from '../store/live';
import { computeMetrics } from '../lib/analytics';
import { download } from '../lib/api';
import { kwh, money } from '../lib/format';
import { PageHeader, Stat } from '../components/ui';

const REPORTS = [
  { path: '/transactions.csv', file: 'sessions.csv', title: 'Sessions', desc: 'Every charging transaction with energy, duration and cost.' },
  { path: '/invoices.csv', file: 'invoices.csv', title: 'Invoices', desc: 'Billing records with status and settlement method.' },
  { path: '/cdrs.csv', file: 'cdrs.csv', title: 'CDRs (OCPI)', desc: 'Charge Detail Records for roaming settlement, incl. VAT.' },
];

export function Reports() {
  const { chargers, transactions, currency } = useScoped();
  const m = computeMetrics(chargers, transactions);

  return (
    <>
      <PageHeader title="Reports" subtitle="Operational and financial exports" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Stat label="Sessions" value={transactions.length} />
        <Stat label="Energy (all time)" value={kwh(m.energyTotalWh)} />
        <Stat label="Revenue (all time)" value={money(m.revenueTotal, currency)} />
        <Stat label="Chargers" value={`${m.chargersOnline}/${m.chargersTotal}`} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {REPORTS.map((r) => (
          <div key={r.path} className="card p-4 flex flex-col">
            <div className="flex items-center gap-2 text-accent">
              <FileSpreadsheet size={18} />
              <span className="font-semibold text-white">{r.title}</span>
            </div>
            <p className="text-sm text-slate-400 mt-2 flex-1">{r.desc}</p>
            <button
              onClick={() => download(r.path, r.file)}
              className="btn-ghost justify-center mt-3"
            >
              <Download size={16} /> Download CSV
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
