import Anthropic from '@anthropic-ai/sdk';
import type { Request, Response } from 'express';
import { config } from './config';
import { log } from './logger';
import { store } from './store';

const SYSTEM = `You are the operations assistant for an EV charging Central System (CSMS) that speaks OCPP 1.6 and 2.0.1.
You help Charge Point Operators (CPOs) understand network health, diagnose faults, and answer questions about chargers, sessions, alerts, tariffs and revenue.

Rules:
- Use ONLY the live network snapshot provided. If the snapshot lacks the data, say so plainly.
- Be concise and operational. Prefer short paragraphs and tight bullet lists. Lead with the answer.
- When diagnosing a charger, trace root cause from: connection state, connector status/errorCode, recent fault alerts, uptime %, and recent OCPP CALLERROR messages. State the most likely cause and a concrete next action.
- Refer to chargers by their id. Don't invent ids, metrics, or events.`;

/** Compact, model-friendly snapshot of current network state. */
function buildSnapshot(): string {
  const chargers = store.listChargers().map((c) => ({
    id: c.id,
    operator: c.tenantId,
    state: c.state,
    protocol: c.protocol,
    vendor: c.vendor,
    model: c.model,
    firmware: c.firmwareVersion,
    uptimePct: c.uptimePct,
    faults24h: c.faults24h,
    powerLimitA: c.powerLimitA,
    connectors: c.connectors.map((x) => ({
      id: x.connectorId,
      status: x.status,
      errorCode: x.errorCode,
      powerW: x.powerW,
    })),
  }));

  const active = store
    .listTransactions()
    .filter((t) => t.state === 'Active')
    .map((t) => ({ id: t.id, charger: t.chargerId, connector: t.connectorId, energyWh: t.energyWh }));

  const alerts = store
    .listAlerts()
    .slice(0, 25)
    .map((a) => ({ at: a.at, charger: a.chargerId, severity: a.severity, type: a.type, message: a.message, ack: a.acknowledged }));

  const recentErrors = store
    .listLogs()
    .filter((l) => l.kind === 'CALLERROR')
    .slice(0, 15)
    .map((l) => ({ at: l.at, charger: l.chargerId, action: l.action, detail: l.payload }));

  const a = store.analytics();
  const groups = store.listLoadGroups().map((g) => ({
    name: g.name,
    limitKw: g.limitKw,
    chargers: g.chargerIds.length,
    activeConnectors: g.activeConnectors,
    allocatedA: g.allocatedA,
  }));

  return JSON.stringify(
    { generatedAt: new Date().toISOString(), summary: a, chargers, activeSessions: active, alerts, recentErrors, loadGroups: groups },
    null,
    2,
  );
}

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Streams the assistant's answer as plain-text chunks. */
export async function assistantHandler(req: Request, res: Response) {
  const history: ChatTurn[] = Array.isArray(req.body?.history) ? req.body.history : [];
  const message: string = String(req.body?.message ?? '').slice(0, 4000);
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const snapshot = buildSnapshot();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  // Without an API key, return a deterministic local briefing so the feature
  // still works in development.
  if (!config.anthropicApiKey) {
    res.write(localFallback(message));
    res.end();
    return;
  }

  try {
    const client = new Anthropic({ apiKey: config.anthropicApiKey });
    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
      {
        role: 'user',
        content: `Live network snapshot (JSON):\n\n${snapshot}\n\nOperator question: ${message}`,
      },
    ];

    const stream = client.messages.stream({
      model: config.assistantModel,
      max_tokens: 2048,
      system: SYSTEM,
      messages,
    });

    stream.on('text', (delta) => res.write(delta));
    await stream.finalMessage();
    res.end();
  } catch (e) {
    log.error('Assistant error:', (e as Error).message);
    if (!res.headersSent) res.status(500);
    res.write(`\n[assistant error: ${(e as Error).message}]`);
    res.end();
  }
}

/** Deterministic briefing used when no Anthropic API key is configured. */
function localFallback(question: string): string {
  const a = store.analytics();
  const chargers = store.listChargers();
  const offline = chargers.filter((c) => c.state === 'Offline');
  const faulted = chargers.filter((c) =>
    c.connectors.some((x) => x.status === 'Faulted'),
  );
  const openAlerts = store.listAlerts().filter((x) => !x.acknowledged);

  const lines = [
    `AI assistant is running in offline mode (no ANTHROPIC_API_KEY set). Here is a computed briefing:`,
    ``,
    `You asked: "${question}"`,
    ``,
    `• Chargers: ${a.chargersOnline}/${a.chargersTotal} online, ${a.connectorsCharging} connectors charging.`,
    `• Sessions: ${a.sessionsActive} active, ${a.sessionsToday} started today.`,
    `• Energy today: ${(a.energyTodayWh / 1000).toFixed(1)} kWh · Revenue today: ${a.revenueToday} ${a.currency}.`,
    `• Open alerts: ${openAlerts.length}.`,
  ];
  if (offline.length)
    lines.push(`• Offline chargers: ${offline.map((c) => c.id).join(', ')}.`);
  if (faulted.length)
    lines.push(`• Faulted connectors on: ${faulted.map((c) => c.id).join(', ')}.`);
  lines.push(
    ``,
    `Set ANTHROPIC_API_KEY on the server to enable natural-language answers and root-cause analysis.`,
  );
  return lines.join('\n');
}
