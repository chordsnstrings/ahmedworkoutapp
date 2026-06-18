import type { ConnectorStatus } from '@ocpp/shared';
import type { ReactNode } from 'react';

export function StateBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
        online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
        }`}
      />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

const CONNECTOR_COLORS: Record<string, string> = {
  Available: 'bg-emerald-500/15 text-emerald-300',
  Charging: 'bg-accent/20 text-cyan-200',
  Occupied: 'bg-amber-500/15 text-amber-300',
  Preparing: 'bg-amber-500/15 text-amber-300',
  Finishing: 'bg-amber-500/15 text-amber-300',
  SuspendedEV: 'bg-amber-500/15 text-amber-300',
  SuspendedEVSE: 'bg-amber-500/15 text-amber-300',
  Reserved: 'bg-violet-500/15 text-violet-300',
  Unavailable: 'bg-slate-500/15 text-slate-400',
  Faulted: 'bg-red-500/15 text-red-300',
  Unknown: 'bg-slate-500/15 text-slate-400',
};

export function ConnectorBadge({ status }: { status: ConnectorStatus }) {
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        CONNECTOR_COLORS[status] ?? CONNECTOR_COLORS.Unknown
      }`}
    >
      {status}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="label">{label}</div>
        {icon && <div className="text-accent">{icon}</div>}
      </div>
      <div className="text-2xl font-bold text-white mt-2">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-slate-300 font-medium">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
