import { useState } from 'react';
import { Gauge, Plus, Trash2, Zap } from 'lucide-react';
import type { LoadGroupDTO } from '@ocpp/shared';
import { api } from '../lib/api';
import { useLive, useScoped } from '../store/live';
import { ALL_TENANTS } from '../store/live';
import { EmptyState, PageHeader } from '../components/ui';

export function LoadGroups() {
  const { loadGroups, chargers } = useScoped();
  const { tenants, tenantId } = useLive();
  const [editing, setEditing] = useState<Partial<LoadGroupDTO> | null>(null);

  const blank: Partial<LoadGroupDTO> = {
    name: '',
    limitKw: 22,
    voltage: 230,
    chargerIds: [],
    tenantId: tenantId === ALL_TENANTS ? tenants[0]?.id : tenantId,
  };

  async function save() {
    if (!editing?.name || !editing.tenantId) return;
    if (editing.id) await api.put(`/load-groups/${editing.id}`, editing);
    else await api.post('/load-groups', editing);
    setEditing(null);
  }

  return (
    <>
      <PageHeader
        title="Load Management"
        subtitle="Share a site power budget across chargers (dynamic load management)"
        actions={
          <button onClick={() => setEditing(blank)} className="btn-primary">
            <Plus size={16} /> New group
          </button>
        }
      />

      {editing && (
        <div className="card p-4 sm:p-5 mb-4 space-y-4">
          <div className="grid sm:grid-cols-4 gap-3">
            <label className="block sm:col-span-2">
              <span className="label">Group name</span>
              <input
                value={editing.name ?? ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="input mt-1"
                placeholder="Basement circuit A"
              />
            </label>
            <label className="block">
              <span className="label">Budget (kW)</span>
              <input
                type="number"
                value={editing.limitKw ?? 22}
                onChange={(e) =>
                  setEditing({ ...editing, limitKw: Number(e.target.value) })
                }
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="label">Voltage</span>
              <input
                type="number"
                value={editing.voltage ?? 230}
                onChange={(e) =>
                  setEditing({ ...editing, voltage: Number(e.target.value) })
                }
                className="input mt-1"
              />
            </label>
          </div>

          <div>
            <span className="label">Chargers in this group</span>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {chargers.map((c) => {
                const checked = editing.chargerIds?.includes(c.id) ?? false;
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm ${
                      checked
                        ? 'border-accent/60 bg-accent/10'
                        : 'border-ink-600/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const ids = new Set(editing.chargerIds ?? []);
                        e.target.checked ? ids.add(c.id) : ids.delete(c.id);
                        setEditing({ ...editing, chargerIds: [...ids] });
                      }}
                    />
                    <span className="truncate text-slate-200">{c.id}</span>
                  </label>
                );
              })}
              {chargers.length === 0 && (
                <span className="text-sm text-slate-500">No chargers available.</span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">
              Save group
            </button>
            <button onClick={() => setEditing(null)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loadGroups.length === 0 ? (
        <EmptyState
          title="No load groups"
          hint="Create a group to cap combined power and auto-balance charging."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {loadGroups.map((g) => (
            <div key={g.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="font-semibold text-white">{g.name}</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(g)}
                    className="btn-ghost py-1 px-2 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => api.del(`/load-groups/${g.id}`)}
                    className="btn-danger py-1 px-2"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 text-2xl font-bold text-white">
                <Zap size={20} className="text-accent" />
                {g.limitKw} kW
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <Metric label="Chargers" value={String(g.chargerIds.length)} />
                <Metric
                  label="Active conns"
                  value={String(g.activeConnectors ?? 0)}
                />
                <Metric
                  label="Per connector"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Gauge size={14} className="text-accent" />
                      {g.allocatedA ?? 0} A
                    </span>
                  }
                />
                <Metric label="Voltage" value={`${g.voltage} V`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-900/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-100 font-medium mt-0.5">{value}</div>
    </div>
  );
}
