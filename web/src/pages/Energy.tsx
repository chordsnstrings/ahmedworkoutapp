import { useMemo, useState } from 'react';
import { BatteryFull, Leaf, Plus, Power, Sun, Zap } from 'lucide-react';
import type { DemandResponseEventDTO } from '@ocpp/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useLive, useScoped } from '../store/live';
import { timeAgo } from '../lib/format';
import { EmptyState, PageHeader, Stat } from '../components/ui';

const STATUS_STYLE: Record<DemandResponseEventDTO['status'], string> = {
  active: 'bg-red-500/15 text-red-300',
  scheduled: 'bg-amber-500/15 text-amber-300',
  ended: 'bg-slate-500/15 text-slate-400',
};

export function Energy() {
  const { can } = useAuth();
  const { loadGroups } = useScoped();
  const { demandResponse } = useLive();
  const groupIds = new Set(loadGroups.map((g) => g.id));
  const events = demandResponse.filter((e) => groupIds.has(e.groupId));

  const [form, setForm] = useState({
    groupId: '',
    name: 'Grid peak event',
    type: 'curtail' as DemandResponseEventDTO['type'],
    magnitudeKw: 10,
    minutes: 30,
  });

  const totals = useMemo(() => {
    const solar = loadGroups.reduce((s, g) => s + (g.solarKw ?? 0), 0);
    const battery = loadGroups.reduce((s, g) => s + (g.batteryKw ?? 0), 0);
    const nominal = loadGroups.reduce((s, g) => s + g.limitKw, 0);
    const effective = loadGroups.reduce(
      (s, g) => s + (g.effectiveLimitKw ?? g.limitKw),
      0,
    );
    return { solar, battery, nominal, effective };
  }, [loadGroups]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    const groupId = form.groupId || loadGroups[0]?.id;
    if (!groupId) return;
    await api.post('/demand-response', { ...form, groupId });
  }

  return (
    <>
      <PageHeader
        title="Energy & Demand Response"
        subtitle="Solar, battery, V2G and grid curtailment across your load groups"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Stat label="Nominal capacity" value={`${totals.nominal} kW`} icon={<Zap size={18} />} />
        <Stat label="Effective now" value={`${totals.effective.toFixed(0)} kW`} icon={<Power size={18} />} />
        <Stat label="Solar" value={`${totals.solar} kW`} icon={<Sun size={18} />} />
        <Stat label="Battery" value={`${totals.battery} kW`} icon={<BatteryFull size={18} />} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        {loadGroups.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              title="No load groups"
              hint="Create a load group on the Load Management page to manage site energy."
            />
          </div>
        ) : (
          loadGroups.map((g) => {
            const eff = g.effectiveLimitKw ?? g.limitKw;
            const pct = Math.min(100, Math.round((eff / Math.max(1, g.limitKw)) * 100));
            return (
              <div key={g.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">{g.name}</div>
                  {g.drActive && (
                    <span className="text-[10px] uppercase tracking-wide bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded">
                      DR active
                    </span>
                  )}
                </div>
                <div className="mt-3 text-2xl font-bold text-white">
                  {eff.toFixed(0)}
                  <span className="text-sm text-slate-500 font-medium"> / {g.limitKw} kW</span>
                </div>
                <div className="h-2 rounded-full bg-ink-900 mt-2 overflow-hidden">
                  <div
                    className={`h-full ${g.drActive ? 'bg-red-400' : 'bg-accent'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex gap-3 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Sun size={12} className="text-amber-300" /> {g.solarKw ?? 0} kW
                  </span>
                  <span className="flex items-center gap-1">
                    <BatteryFull size={12} className="text-emerald-300" /> {g.batteryKw ?? 0} kW
                    {g.batterySoc ? ` (${g.batterySoc}%)` : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {can('operator') && loadGroups.length > 0 && (
        <form onSubmit={createEvent} className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <label className="block col-span-2 sm:col-span-1">
            <span className="label">Group</span>
            <select
              value={form.groupId}
              onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              className="input mt-1"
            >
              {loadGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block col-span-2 sm:col-span-1">
            <span className="label">Event name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="input mt-1"
            >
              <option value="curtail">Curtail</option>
              <option value="v2g">V2G</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Shed (kW)</span>
            <input type="number" value={form.magnitudeKw} onChange={(e) => setForm({ ...form, magnitudeKw: Number(e.target.value) })} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Minutes</span>
            <input type="number" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })} className="input mt-1" />
          </label>
          <button type="submit" className="btn-primary justify-center">
            <Plus size={16} /> Trigger
          </button>
        </form>
      )}

      <div className="card p-4 sm:p-5">
        <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Leaf size={16} className="text-emerald-300" /> Demand-response events
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No demand-response events.</p>
        ) : (
          <ul className="divide-y divide-ink-600/40">
            {events.map((e) => {
              const group = loadGroups.find((g) => g.id === e.groupId);
              return (
                <li key={e.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-slate-100 font-medium">
                      {e.name}{' '}
                      <span className="text-xs text-slate-500">
                        · {group?.name ?? e.groupId} · {e.type === 'v2g' ? 'V2G' : 'curtail'} −{e.magnitudeKw} kW
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {e.status === 'scheduled' ? 'starts' : 'started'} {timeAgo(e.startsAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>
                      {e.status}
                    </span>
                    {can('operator') && e.status !== 'ended' && (
                      <button
                        onClick={() => api.post(`/demand-response/${e.id}/cancel`)}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        End
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
