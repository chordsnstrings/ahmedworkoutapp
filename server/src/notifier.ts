import type { ServerEvent, WebhookDTO } from '@ocpp/shared';
import { bus } from './events';
import { log } from './logger';
import { store } from './store';

/** Which live events are forwardable to webhooks (high-frequency ones excluded). */
function forwardable(e: ServerEvent): { event: string; payload: unknown } | null {
  switch (e.type) {
    case 'alert':
      return { event: 'alert', payload: e.alert };
    case 'reservation':
      return { event: 'reservation', payload: e.reservation };
    case 'demandresponse':
      return { event: 'demandresponse', payload: e.event };
    case 'transaction':
      // Only notify on completed sessions, not every meter sample.
      return e.transaction.state === 'Ended'
        ? { event: 'transaction', payload: e.transaction }
        : null;
    default:
      return null;
  }
}

function subscribed(w: WebhookDTO, event: string) {
  return w.events.includes('all') || w.events.includes(event as never);
}

export async function deliver(webhook: WebhookDTO, event: string, payload: unknown) {
  const body = JSON.stringify({ event, payload, at: new Date().toISOString() });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSMS-Event': event,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    store.recordDelivery({
      webhookId: webhook.id,
      event,
      status: res.ok ? 'ok' : 'failed',
      httpStatus: res.status,
    });
  } catch (e) {
    store.recordDelivery({
      webhookId: webhook.id,
      event,
      status: 'failed',
      error: (e as Error).message,
    });
  }
}

export function startNotifier() {
  bus.onEvent((e) => {
    const f = forwardable(e);
    if (!f) return;
    for (const w of store.activeWebhooks())
      if (subscribed(w, f.event)) void deliver(w, f.event, f.payload);
  });
  log.info('Webhook notifier started');
}
