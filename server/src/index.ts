import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { config } from './config';
import { log } from './logger';
import { createApiRouter } from './api/rest';
import { startLoadManager } from './load';
import { startNotifier } from './notifier';
import { startPersistence } from './persistence';
import { createOcpiRouter } from './ocpi/server';
import { attachOcppServer } from './ocpp/server';

const here = dirname(fileURLToPath(import.meta.url));
const webDist = config.webDist || resolve(here, '../../web/dist');

async function bootstrap() {
  // Restore persisted state (Postgres or file) before accepting connections.
  await startPersistence();

  const app = express();
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Unauthenticated health check for load balancers / platform probes.
  app.get('/healthz', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  app.use('/api', createApiRouter());
  app.use('/ocpi', createOcpiRouter());

  app.get('/api-info', (_req, res) =>
    res.json({
      name: 'OCPP CSMS',
      ocpp: ['1.6', '2.0.1'],
      websocket: `${config.publicUrl.replace(/^http/, 'ws')}/ocpp/<chargePointId>`,
    }),
  );

  // Serve the built dashboard (single-service deploy) with SPA fallback.
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api|ocpi|ocpp|healthz).*/, (_req, res) =>
      res.sendFile(join(webDist, 'index.html')),
    );
    log.info(`Serving dashboard from ${webDist}`);
  }

  const httpServer = createServer(app);
  attachOcppServer(httpServer);
  startLoadManager();
  startNotifier();

  httpServer.listen(config.port, () => {
    log.info(`CSMS listening on :${config.port}`);
    log.info(`  REST API  → /api`);
    log.info(`  OCPP WS   → /ocpp/<chargePointId>`);
    log.info(`  OCPI      → /ocpi/versions`);
    if (config.apiKey) log.info('  API key auth is ENABLED');
  });
}

void bootstrap();
