import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { ChargerDTO } from '@ocpp/shared';
import { useScoped } from '../store/live';
import { EmptyState, PageHeader, StateBadge } from '../components/ui';

function pinColor(c: ChargerDTO) {
  if (c.state === 'Offline') return '#64748b';
  if (c.connectors.some((x) => x.status === 'Faulted')) return '#f87171';
  if (c.connectors.some((x) => x.status === 'Charging')) return '#22d3ee';
  return '#34d399';
}

export function StationMap() {
  const { chargers } = useScoped();
  const navigate = useNavigate();
  const [hover, setHover] = useState<string | null>(null);

  const located = chargers.filter((c) => c.lat != null && c.lng != null);
  const unlocated = chargers.filter((c) => c.lat == null || c.lng == null);

  const points = useMemo(() => {
    if (located.length === 0) return [];
    const lats = located.map((c) => c.lat!);
    const lngs = located.map((c) => c.lng!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = maxLat - minLat || 0.01;
    const spanLng = maxLng - minLng || 0.01;
    const pad = 8;
    return located.map((c) => ({
      charger: c,
      // Longitude → x, latitude → y (inverted), normalised into a 0–100 box.
      x: pad + ((c.lng! - minLng) / spanLng) * (100 - pad * 2),
      y: pad + ((maxLat - c.lat!) / spanLat) * (100 - pad * 2),
    }));
  }, [located]);

  return (
    <>
      <PageHeader
        title="Station Map"
        subtitle={`${located.length} located stations${unlocated.length ? ` · ${unlocated.length} without coordinates` : ''}`}
      />

      {located.length === 0 ? (
        <EmptyState title="No located stations" hint="Add coordinates to chargers to see them here." />
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card p-2 sm:p-3">
            <div className="relative w-full aspect-[16/10] rounded-lg bg-ink-900 overflow-hidden">
              {/* subtle grid backdrop */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                {Array.from({ length: 9 }, (_, i) => (
                  <g key={i} stroke="#16202e" strokeWidth="0.2">
                    <line x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="100" />
                    <line x1="0" y1={(i + 1) * 10} x2="100" y2={(i + 1) * 10} />
                  </g>
                ))}
                {points.map((p) => (
                  <g
                    key={p.charger.id}
                    transform={`translate(${p.x} ${p.y})`}
                    className="cursor-pointer"
                    onClick={() => navigate(`/chargers/${p.charger.id}`)}
                    onMouseEnter={() => setHover(p.charger.id)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <circle r={hover === p.charger.id ? 3.2 : 2.4} fill={pinColor(p.charger)} opacity="0.25" />
                    <circle r="1.4" fill={pinColor(p.charger)} />
                  </g>
                ))}
              </svg>
              {points.map((p) =>
                hover === p.charger.id ? (
                  <div
                    key={p.charger.id}
                    className="absolute -translate-x-1/2 -translate-y-full pointer-events-none bg-ink-700 border border-ink-600 rounded-md px-2 py-1 text-xs text-slate-100 shadow-xl whitespace-nowrap"
                    style={{ left: `${p.x}%`, top: `${p.y - 2}%` }}
                  >
                    {p.charger.id} · {p.charger.city ?? ''}
                  </div>
                ) : null,
              )}
            </div>
            <div className="flex flex-wrap gap-3 px-2 py-2 text-xs text-slate-400">
              <Legend color="#34d399" label="Available" />
              <Legend color="#22d3ee" label="Charging" />
              <Legend color="#f87171" label="Faulted" />
              <Legend color="#64748b" label="Offline" />
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <h2 className="font-semibold text-white mb-3">Stations</h2>
            <ul className="divide-y divide-ink-600/40 max-h-[28rem] overflow-y-auto">
              {located.map((c) => (
                <li
                  key={c.id}
                  onClick={() => navigate(`/chargers/${c.id}`)}
                  className="flex items-center justify-between py-2.5 cursor-pointer hover:text-accent"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={14} style={{ color: pinColor(c) }} className="shrink-0" />
                    <div className="min-w-0">
                      <div className="text-slate-100 truncate">{c.id}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {c.address ?? ''}{c.city ? `, ${c.city}` : ''}
                      </div>
                    </div>
                  </div>
                  <StateBadge online={c.state === 'Online'} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
