import { Link } from 'react-router-dom';
import { AlertTriangle, Check, CheckCheck, Info, XOctagon } from 'lucide-react';
import type { AlertSeverity } from '@ocpp/shared';
import { api } from '../lib/api';
import { useScoped } from '../store/live';
import { timeAgo } from '../lib/format';
import { EmptyState, PageHeader } from '../components/ui';

const SEV: Record<
  AlertSeverity,
  { icon: typeof Info; cls: string; dot: string }
> = {
  info: { icon: Info, cls: 'text-sky-300', dot: 'bg-sky-400' },
  warning: { icon: AlertTriangle, cls: 'text-amber-300', dot: 'bg-amber-400' },
  critical: { icon: XOctagon, cls: 'text-red-300', dot: 'bg-red-400' },
};

export function Alerts() {
  const { alerts } = useScoped();
  const open = alerts.filter((a) => !a.acknowledged);

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle={`${open.length} open · ${alerts.length} total`}
        actions={
          open.length > 0 && (
            <button onClick={() => api.post('/alerts/ack')} className="btn-ghost">
              <CheckCheck size={16} /> Acknowledge all
            </button>
          )
        }
      />

      {alerts.length === 0 ? (
        <EmptyState
          title="No alerts"
          hint="Faults and offline events appear here automatically."
        />
      ) : (
        <div className="card divide-y divide-ink-600/40">
          {alerts.map((a) => {
            const s = SEV[a.severity];
            const Icon = s.icon;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  a.acknowledged ? 'opacity-50' : ''
                }`}
              >
                <Icon size={18} className={s.cls} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-100">{a.message}</div>
                  <div className="text-xs text-slate-500">
                    <Link
                      to={`/chargers/${a.chargerId}`}
                      className="hover:text-accent"
                    >
                      {a.chargerId}
                    </Link>{' '}
                    · {timeAgo(a.at)}
                  </div>
                </div>
                {!a.acknowledged && (
                  <button
                    onClick={() => api.post(`/alerts/${a.id}/ack`)}
                    className="btn-ghost py-1 px-2 text-xs"
                  >
                    <Check size={14} /> Ack
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
