import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { OCPP_SUBPROTOCOLS, subprotocolToVersion } from '@ocpp/shared';
import { config } from '../config';
import { log } from '../logger';
import { store } from '../store';
import { ChargePointConnection } from './connection';

/** Registry of currently connected charge points, keyed by charge point id. */
export const connections = new Map<string, ChargePointConnection>();

/** Extract the charge point id from a URL like `/ocpp/CP_123` or `/CP_123`. */
function chargePointIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const path = url.split('?')[0].replace(/\/+$/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'ocpp') segments.shift();
  const id = segments.join('/');
  return id || null;
}

export function attachOcppServer(httpServer: Server) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: undefined,
    // Negotiate one of the OCPP subprotocols the charge point offers.
    handleProtocols: (protocols) => {
      for (const p of [OCPP_SUBPROTOCOLS['2.0.1'], OCPP_SUBPROTOCOLS['1.6']])
        if (protocols.has(p)) return p;
      return false;
    },
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const id = chargePointIdFromUrl(req.url);
    const version = subprotocolToVersion(ws.protocol);

    if (!id || !version) {
      log.warn(
        `Rejecting connection (url=${req.url}, protocol=${ws.protocol || 'none'})`,
      );
      ws.close(1002, 'Missing charge point id or unsupported subprotocol');
      return;
    }

    // Only one live session per charge point id.
    connections.get(id)?.close();
    const conn = new ChargePointConnection(id, version, ws);
    connections.set(id, conn);

    store.upsertCharger(id, {
      protocol: version,
      state: 'Online',
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });
    log.info(`Charge point connected: ${id} (OCPP ${version})`);

    ws.on('message', (data) => {
      store.markSeen(id);
      conn.handleRaw(data.toString());
    });

    ws.on('close', () => {
      if (connections.get(id) === conn) {
        connections.delete(id);
        store.setOffline(id);
        log.info(`Charge point disconnected: ${id}`);
      }
      conn.close();
    });

    ws.on('error', (e) => log.error(`WS error for ${id}:`, e.message));
  });

  // Sweep for silent connections (no traffic within the offline window).
  setInterval(() => {
    const cutoff = Date.now() - config.offlineAfterMs;
    for (const charger of store.listChargers()) {
      if (
        charger.state === 'Online' &&
        charger.lastSeen &&
        Date.parse(charger.lastSeen) < cutoff
      ) {
        store.setOffline(charger.id);
      }
    }
  }, 15_000).unref();

  log.info('OCPP WebSocket server attached (ocpp1.6, ocpp2.0.1)');
  return wss;
}
