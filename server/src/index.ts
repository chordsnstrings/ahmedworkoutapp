import { createServer } from 'node:http';
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

// Restore persisted state before wiring up routes.
startPersistence();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', createApiRouter());
app.use('/ocpi', createOcpiRouter());

app.get('/', (_req, res) =>
  res.json({
    name: 'OCPP CSMS',
    ocpp: ['1.6', '2.0.1'],
    websocket: `ws://<host>:${config.port}/ocpp/<chargePointId>`,
    api: '/api',
  }),
);

const httpServer = createServer(app);
attachOcppServer(httpServer);
startLoadManager();
startNotifier();

httpServer.listen(config.port, () => {
  log.info(`CSMS listening on http://localhost:${config.port}`);
  log.info(`  REST API  → http://localhost:${config.port}/api`);
  log.info(`  OCPP WS   → ws://localhost:${config.port}/ocpp/<chargePointId>`);
  if (config.apiKey) log.info('  API key auth is ENABLED');
});
