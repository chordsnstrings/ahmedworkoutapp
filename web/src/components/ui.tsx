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

/** Minimal inline-SVG sparkline (no chart lib) for KPI cards and table cells. */
export function Sparkline({
  data,
  color = '#22d3ee',
  width = 96,
  height = 28,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Trend pill: signed % change, coloured by direction (invert for "lower is better"). */
export function Trend({ pct, goodWhenUp = true }: { pct: number; goodWhenUp?: boolean }) {
  if (!isFinite(pct) || pct === 0)
    return <span className="text-xs text-slate-500">—</span>;
  const up = pct > 0;
  const good = up === goodWhenUp;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        good ? 'text-emerald-400' : 'text-red-400'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  trend,
  goodWhenUp = true,
  spark,
  sparkColor,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: number;
  goodWhenUp?: boolean;
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="label">{label}</div>
        {icon && <div className="text-accent">{icon}</div>}
      </div>
      <div className="flex items-end justify-between gap-2 mt-2">
        <div className="text-2xl font-bold text-white tabular-nums tracking-tight">{value}</div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && <Trend pct={trend} goodWhenUp={goodWhenUp} />}
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

/** Skeleton placeholder block to reduce layout shift while loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-ink-600/40 rounded ${className}`} />;
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
