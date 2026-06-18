import { useEffect, useState } from 'react';
import { Plus, Send, Trash2, Webhook } from 'lucide-react';
import type { WebhookDeliveryDTO, WebhookDTO, WebhookEvent } from '@ocpp/shared';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { EmptyState, PageHeader } from '../components/ui';

const EVENTS: WebhookEvent[] = ['alert', 'transaction', 'reservation', 'demandresponse'];

export function Notifications() {
  const [hooks, setHooks] = useState<WebhookDTO[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryDTO[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['alert']);

  async function load() {
    const [h, d] = await Promise.all([
      api.get<WebhookDTO[]>('/webhooks'),
      api.get<WebhookDeliveryDTO[]>('/webhook-deliveries'),
    ]);
    setHooks(h);
    setDeliveries(d);
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => api.get<WebhookDeliveryDTO[]>('/webhook-deliveries').then(setDeliveries), 5000);
    return () => clearInterval(t);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    await api.post('/webhooks', { url: url.trim(), events });
    setUrl('');
    await load();
  }

  return (
    <>
      <PageHeader title="Notifications" subtitle="Webhook subscriptions for platform events" />

      <form onSubmit={add} className="card p-4 mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="input flex-1 font-mono text-xs"
          />
          <button type="submit" className="btn-primary justify-center">
            <Plus size={16} /> Add webhook
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((ev) => {
            const on = events.includes(ev);
            return (
              <button
                type="button"
                key={ev}
                onClick={() =>
                  setEvents(on ? events.filter((x) => x !== ev) : [...events, ev])
                }
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  on ? 'border-accent/60 bg-accent/10 text-accent' : 'border-ink-600/60 text-slate-400'
                }`}
              >
                {ev}
              </button>
            );
          })}
        </div>
      </form>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-3">Endpoints</h2>
          {hooks.length === 0 ? (
            <p className="text-sm text-slate-500">No webhooks configured.</p>
          ) : (
            <ul className="space-y-2">
              {hooks.map((w) => (
                <li key={w.id} className="rounded-lg border border-ink-600/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-slate-200 truncate flex items-center gap-2">
                      <Webhook size={14} className="text-accent shrink-0" />
                      {w.url}
                    </code>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => api.post(`/webhooks/${w.id}/test`).then(load)} className="btn-ghost py-1 px-2 text-xs">
                        <Send size={13} /> Test
                      </button>
                      <button
                        onClick={() => api.put(`/webhooks/${w.id}`, { ...w, active: !w.active }).then(load)}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        {w.active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => api.del(`/webhooks/${w.id}`).then(load)} className="btn-danger py-1 px-2">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.events.map((ev) => (
                      <span key={ev} className="text-[10px] bg-ink-900/60 text-slate-400 px-1.5 py-0.5 rounded">
                        {ev}
                      </span>
                    ))}
                    {!w.active && <span className="text-[10px] text-amber-300">disabled</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="font-semibold text-white mb-3">Recent deliveries</h2>
          {deliveries.length === 0 ? (
            <EmptyState title="No deliveries yet" hint="Deliveries appear as events fire." />
          ) : (
            <ul className="divide-y divide-ink-600/40 max-h-80 overflow-y-auto text-sm">
              {deliveries.slice(0, 50).map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-slate-200">{d.event}</span>
                    <span className="text-xs text-slate-500 ml-2">{dateTime(d.at)}</span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      d.status === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                    }`}
                  >
                    {d.status === 'ok' ? `${d.httpStatus}` : d.error?.slice(0, 28) ?? 'failed'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
