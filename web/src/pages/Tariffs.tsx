import { useEffect, useState } from 'react';
import { Clock, Plus, Star, Trash2, X } from 'lucide-react';
import type { TariffDTO, TariffWindow } from '@ocpp/shared';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { EmptyState, PageHeader } from '../components/ui';

const blank = {
  name: '',
  currency: 'USD',
  pricePerKwh: 0.35,
  pricePerHour: 0,
  sessionFee: 0.5,
  isDefault: false,
  appliesToGroup: '',
};

export function Tariffs() {
  const [tariffs, setTariffs] = useState<TariffDTO[]>([]);
  const [form, setForm] = useState({ ...blank });
  const [error, setError] = useState('');

  async function load() {
    setTariffs(await api.get<TariffDTO[]>('/tariffs'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post('/tariffs', {
      ...form,
      appliesToGroup: form.appliesToGroup.trim() || undefined,
    });
    setForm({ ...blank });
    await load();
  }

  async function update(t: TariffDTO, patch: Partial<TariffDTO>) {
    await api.put(`/tariffs/${t.id}`, { ...t, ...patch });
    await load();
  }

  async function remove(t: TariffDTO) {
    try {
      await api.del(`/tariffs/${t.id}`);
      setError('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Tariffs"
        subtitle="Pricing with time-of-use windows and access-group targeting"
      />

      <form
        onSubmit={add}
        className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end"
      >
        <label className="block col-span-2 sm:col-span-1">
          <span className="label">Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input mt-1"
            placeholder="Peak"
          />
        </label>
        <label className="block">
          <span className="label">Per kWh</span>
          <input
            type="number"
            step="0.01"
            value={form.pricePerKwh}
            onChange={(e) => setForm({ ...form, pricePerKwh: Number(e.target.value) })}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Per hour</span>
          <input
            type="number"
            step="0.01"
            value={form.pricePerHour}
            onChange={(e) => setForm({ ...form, pricePerHour: Number(e.target.value) })}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Session fee</span>
          <input
            type="number"
            step="0.01"
            value={form.sessionFee}
            onChange={(e) => setForm({ ...form, sessionFee: Number(e.target.value) })}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Group</span>
          <input
            value={form.appliesToGroup}
            onChange={(e) => setForm({ ...form, appliesToGroup: e.target.value })}
            className="input mt-1"
            placeholder="any"
          />
        </label>
        <button type="submit" className="btn-primary justify-center">
          <Plus size={16} /> Add
        </button>
      </form>
      {error && <p className="text-sm text-red-300 mb-3">{error}</p>}

      {tariffs.length === 0 ? (
        <EmptyState title="No tariffs" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {tariffs.map((t) => (
            <TariffCard
              key={t.id}
              tariff={t}
              onDefault={() => update(t, { isDefault: true })}
              onDelete={() => remove(t)}
              onWindows={(windows) => update(t, { windows })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TariffCard({
  tariff: t,
  onDefault,
  onDelete,
  onWindows,
}: {
  tariff: TariffDTO;
  onDefault: () => void;
  onDelete: () => void;
  onWindows: (w: TariffWindow[]) => void;
}) {
  const [win, setWin] = useState({ startHour: 22, endHour: 6, pricePerKwh: 0.2 });
  const windows = t.windows ?? [];

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-white flex items-center gap-2">
            {t.name}
            {t.isDefault && (
              <span className="text-[10px] uppercase tracking-wide bg-accent/15 text-accent px-1.5 py-0.5 rounded">
                Default
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {t.currency}
            {t.appliesToGroup ? ` · group: ${t.appliesToGroup}` : ''}
          </div>
        </div>
        <div className="flex gap-1">
          {!t.isDefault && (
            <>
              <button onClick={onDefault} className="btn-ghost py-1 px-2" title="Set as default">
                <Star size={14} />
              </button>
              <button onClick={onDelete} className="btn-danger py-1 px-2" title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        <Row label="Energy" value={`${money(t.pricePerKwh, t.currency)} / kWh`} />
        <Row label="Time" value={`${money(t.pricePerHour, t.currency)} / h`} />
        <Row label="Session fee" value={money(t.sessionFee, t.currency)} />
      </dl>

      <div className="mt-4 pt-3 border-t border-ink-600/50">
        <div className="label flex items-center gap-1.5 mb-2">
          <Clock size={12} /> Time-of-use windows
        </div>
        {windows.length > 0 && (
          <ul className="space-y-1 mb-2">
            {windows.map((w, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-xs bg-ink-900/50 rounded px-2 py-1.5"
              >
                <span className="text-slate-300">
                  {String(w.startHour).padStart(2, '0')}:00–
                  {String(w.endHour).padStart(2, '0')}:00
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-accent">{money(w.pricePerKwh, t.currency)}/kWh</span>
                  <button
                    onClick={() => onWindows(windows.filter((_, j) => j !== i))}
                    className="text-slate-500 hover:text-red-300"
                  >
                    <X size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={23}
            value={win.startHour}
            onChange={(e) => setWin({ ...win, startHour: Number(e.target.value) })}
            className="input py-1 px-2 text-xs w-14"
            title="Start hour"
          />
          <span className="text-slate-600 text-xs">–</span>
          <input
            type="number"
            min={1}
            max={24}
            value={win.endHour}
            onChange={(e) => setWin({ ...win, endHour: Number(e.target.value) })}
            className="input py-1 px-2 text-xs w-14"
            title="End hour"
          />
          <input
            type="number"
            step="0.01"
            value={win.pricePerKwh}
            onChange={(e) => setWin({ ...win, pricePerKwh: Number(e.target.value) })}
            className="input py-1 px-2 text-xs flex-1"
            title="Price per kWh"
          />
          <button
            onClick={() => onWindows([...windows, win])}
            className="btn-ghost py-1 px-2"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}
