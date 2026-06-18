import { useEffect, useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import type { TariffDTO } from '@ocpp/shared';
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
    await api.post('/tariffs', form);
    setForm({ ...blank });
    await load();
  }

  async function makeDefault(t: TariffDTO) {
    await api.put(`/tariffs/${t.id}`, { ...t, isDefault: true });
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
      <PageHeader title="Tariffs" subtitle="Pricing applied to charging sessions" />

      <form
        onSubmit={add}
        className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end"
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
            <div key={t.id} className="card p-4">
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
                  <div className="text-xs text-slate-500">{t.currency}</div>
                </div>
                <div className="flex gap-1">
                  {!t.isDefault && (
                    <>
                      <button
                        onClick={() => makeDefault(t)}
                        className="btn-ghost py-1 px-2"
                        title="Set as default"
                      >
                        <Star size={14} />
                      </button>
                      <button
                        onClick={() => remove(t)}
                        className="btn-danger py-1 px-2"
                        title="Delete"
                      >
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
            </div>
          ))}
        </div>
      )}
    </>
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
