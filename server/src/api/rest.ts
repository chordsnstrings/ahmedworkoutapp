import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config';
import { store } from '../store';
import { connections } from '../ocpp/server';
import { transactionToCdr } from '../ocpi/mappers';
import {
  authMiddleware,
  deleteUser,
  listUsers,
  login,
  requireRole,
  upsertUser,
} from '../auth';
import { checkout } from '../payments';
import { assistantHandler } from '../assistant';
import { sseHandler } from './sse';

/** Wrap async handlers so rejections become 500s instead of crashing. */
const h =
  (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

/** Render rows to CSV using the given column keys. */
function toCsv(header: string[], rows: Record<string, unknown>[]): string {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    header.join(','),
    ...rows.map((r) => header.map((k) => cell(r[k])).join(',')),
  ].join('\n');
}

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

/** Look up a live connection or send 409 if the charger is offline. */
function requireConnection(req: Request, res: Response) {
  const conn = connections.get(req.params.id);
  if (!conn) {
    res.status(409).json({ error: 'Charge point is offline' });
    return null;
  }
  return conn;
}

export function createApiRouter() {
  const api = Router();
  const operator = requireRole('operator');
  const admin = requireRole('admin');

  // ------------------------------------------------------------------- auth
  api.post(
    '/auth/login',
    h((req, res) => {
      const result = login(req.body.email ?? '', req.body.password ?? '');
      if (!result) return res.status(401).json({ error: 'Invalid credentials' });
      res.json(result);
    }),
  );

  // Public guest charging (QR / ad-hoc) — no login required.
  api.post(
    '/public/charge/:id',
    h(async (req, res) => {
      const conn = connections.get(req.params.id);
      if (!conn)
        return res.status(409).json({ error: 'Charge point is offline' });
      const idTag = `GUEST-${Date.now().toString(36).toUpperCase()}`;
      store.upsertToken({ idTag, label: 'Guest (ad-hoc)', status: 'Accepted', group: 'guest' });
      const result = await conn.remoteStart(idTag, Number(req.body.connectorId ?? 1));
      res.json({ idTag, result });
    }),
  );

  // Everything below requires a valid session token.
  api.use(authMiddleware);

  api.get('/auth/me', (req, res) => res.json(req.user));

  // Audit trail: record successful mutating actions by authenticated users.
  api.use((req, res, next) => {
    if (req.method !== 'GET' && req.user) {
      res.on('finish', () => {
        if (res.statusCode < 400)
          store.addAudit({
            user: req.user!.email,
            role: req.user!.role,
            action: `${req.method} ${req.path}`,
            target: req.params?.id ?? '',
          });
      });
    }
    next();
  });
  api.get('/audit', admin, (_req, res) => res.json(store.listAudit()));

  // ----------------------------------------------------------- live + meta
  api.get('/events', sseHandler);
  api.get('/health', (_req, res) => res.json({ ok: true }));

  // -------------------------------------------------------------- users (admin)
  api.get('/users', admin, (_req, res) => res.json(listUsers()));
  api.post('/users', admin, h((req, res) => res.status(201).json(upsertUser(req.body))));
  api.put('/users/:id', admin, h((req, res) =>
    res.json(upsertUser({ ...req.body, id: req.params.id })),
  ));
  api.delete('/users/:id', admin, (req, res) => {
    deleteUser(req.params.id);
    res.status(204).end();
  });

  // ----------------------------------------------------------- invoices / pay
  api.get('/invoices', (_req, res) => res.json(store.listInvoices()));
  api.post('/payments/checkout/:invoiceId', operator, h(async (req, res) => {
    res.json(await checkout(req.params.invoiceId));
  }));

  api.get('/branding', (_req, res) => res.json(store.branding));
  api.put(
    '/branding',
    admin,
    h((req, res) => {
      store.branding = { ...store.branding, ...req.body };
      res.json(store.branding);
    }),
  );

  api.get('/analytics', (_req, res) => res.json(store.analytics()));

  // AI ops assistant (read-only; available to all roles).
  api.post('/assistant', assistantHandler);

  // From here down, any state-changing request requires operator role.
  api.use((req, res, next) =>
    req.method === 'GET' ? next() : operator(req, res, next),
  );

  // ----------------------------------------------------------- roaming (OCPI)
  const ocpiBase = `${config.publicUrl.replace(/\/$/, '')}/ocpi`;
  api.get('/roaming/info', (_req, res) => {
    const txs = store.listTransactions();
    res.json({
      versionsUrl: `${ocpiBase}/versions`,
      versionDetailUrl: `${ocpiBase}/2.2.1`,
      countryCode: config.ocpiCountryCode,
      partyId: config.ocpiPartyId,
      locations: store.listChargers().length,
      sessions: txs.length,
      cdrs: txs.filter((t) => t.state === 'Ended').length,
      partners: store.listPartners().length,
    });
  });
  api.get('/roaming/partners', (_req, res) => res.json(store.listPartners()));
  api.post('/roaming/partners', operator, h((req, res) =>
    res.status(201).json(store.registerPartner(req.body)),
  ));
  api.delete('/roaming/partners/:id', operator, (req, res) => {
    store.deletePartner(req.params.id);
    res.status(204).end();
  });
  api.get('/roaming/cdrs', (_req, res) =>
    res.json(
      store
        .listTransactions()
        .filter((t) => t.state === 'Ended')
        .map(transactionToCdr),
    ),
  );

  // --------------------------------------------------------------- tenants
  api.get('/tenants', (_req, res) => res.json(store.listTenants()));
  api.post(
    '/chargers/:id/tenant',
    h((req, res) => {
      store.assignTenant(req.params.id, req.body.tenantId);
      res.json(store.getCharger(req.params.id) ?? {});
    }),
  );
  api.post(
    '/chargers/:id/location',
    h((req, res) => {
      store.setLocation(req.params.id, {
        lat: req.body.lat != null ? Number(req.body.lat) : undefined,
        lng: req.body.lng != null ? Number(req.body.lng) : undefined,
        address: req.body.address,
        city: req.body.city,
      });
      res.json(store.getCharger(req.params.id) ?? {});
    }),
  );

  // -------------------------------------------------------------- chargers
  api.get('/chargers', (_req, res) => res.json(store.listChargers()));
  api.get('/chargers/:id', (req, res) => {
    const c = store.getCharger(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  });

  api.post(
    '/chargers/:id/remote-start',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      const result = await conn.remoteStart(
        req.body.idTag ?? 'RFID-0001',
        req.body.connectorId,
      );
      res.json(result);
    }),
  );

  api.post(
    '/chargers/:id/remote-stop',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(await conn.remoteStop(String(req.body.transactionId)));
    }),
  );

  api.post(
    '/chargers/:id/reset',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(await conn.reset(req.body.type === 'Hard' ? 'Hard' : 'Soft'));
    }),
  );

  api.post(
    '/chargers/:id/availability',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(
        await conn.changeAvailability(
          Number(req.body.connectorId),
          Boolean(req.body.operative),
        ),
      );
    }),
  );

  api.post(
    '/chargers/:id/power-limit',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      const limitA = Number(req.body.limitA);
      const result = await conn.setPowerLimit(
        Number(req.body.connectorId),
        limitA,
      );
      store.upsertCharger(req.params.id, { powerLimitA: limitA });
      res.json(result);
    }),
  );

  api.post(
    '/chargers/:id/trigger',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(
        await conn.triggerMessage(
          req.body.requestedMessage,
          req.body.connectorId,
        ),
      );
    }),
  );

  api.post(
    '/chargers/:id/config',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      const config = await conn.getConfiguration();
      store.setConfig(req.params.id, config);
      res.json(config);
    }),
  );

  api.post(
    '/chargers/:id/config/set',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      const result = await conn.changeConfiguration(
        req.body.key,
        String(req.body.value),
      );
      res.json(result);
    }),
  );

  api.post(
    '/chargers/:id/firmware',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(await conn.updateFirmware(req.body.location));
    }),
  );

  api.post(
    '/chargers/:id/diagnostics',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(await conn.getDiagnostics(req.body.location));
    }),
  );

  api.post(
    '/chargers/:id/charging-profile',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(
        await conn.setChargingSchedule(
          Number(req.body.connectorId),
          req.body.periods ?? [],
          req.body.unit ?? 'A',
          req.body.purpose,
        ),
      );
    }),
  );
  api.post(
    '/chargers/:id/clear-profile',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(await conn.clearChargingProfile(req.body.connectorId));
    }),
  );
  api.post(
    '/chargers/:id/composite-schedule',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(
        await conn.getCompositeSchedule(
          Number(req.body.connectorId ?? 1),
          Number(req.body.duration ?? 86400),
        ),
      );
    }),
  );

  api.post(
    '/chargers/:id/display-message',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(
        await conn.setDisplayMessage(
          String(req.body.content ?? ''),
          req.body.priority,
        ),
      );
    }),
  );
  api.post(
    '/chargers/:id/cost-update',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      res.json(
        await conn.costUpdated(
          String(req.body.transactionId),
          Number(req.body.cost ?? 0),
        ),
      );
    }),
  );

  api.post(
    '/chargers/:id/local-list/version',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      const version = await conn.getLocalListVersion();
      store.setLocalListVersion(req.params.id, version);
      res.json({ version });
    }),
  );
  api.post(
    '/chargers/:id/local-list/sync',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      const tokens = store.acceptedTokens();
      const version = (store.getCharger(req.params.id)?.localListVersion ?? 0) + 1;
      const result = await conn.sendLocalList(version, tokens);
      store.setLocalListVersion(req.params.id, version);
      res.json({ version, count: tokens.length, result });
    }),
  );

  // ---------------------------------------------------------------- alerts
  api.get('/alerts', (_req, res) => res.json(store.listAlerts()));
  api.post('/alerts/ack', (_req, res) => {
    store.ackAllAlerts();
    res.json({ ok: true });
  });
  api.post('/alerts/:id/ack', (req, res) => res.json(store.ackAlert(req.params.id) ?? {}));

  // ------------------------------------------------------------ load groups
  api.get('/load-groups', (_req, res) => res.json(store.listLoadGroups()));
  api.post(
    '/load-groups',
    h((req, res) => res.status(201).json(store.upsertLoadGroup(req.body))),
  );
  api.put(
    '/load-groups/:id',
    h((req, res) =>
      res.json(store.upsertLoadGroup({ ...req.body, id: req.params.id })),
    ),
  );
  api.delete('/load-groups/:id', (req, res) => {
    store.deleteLoadGroup(req.params.id);
    res.status(204).end();
  });

  // -------------------------------------------------------- demand response
  api.get('/demand-response', (_req, res) =>
    res.json(store.listDemandResponse()),
  );
  api.post('/demand-response', h((req, res) =>
    res.status(201).json(store.createDemandResponse(req.body)),
  ));
  api.post('/demand-response/:id/cancel', (req, res) =>
    res.json(store.cancelDemandResponse(req.params.id) ?? {}),
  );

  // --------------------------------------------------------- reservations
  api.get('/reservations', (_req, res) => res.json(store.listReservations()));
  api.post(
    '/chargers/:id/reserve',
    h(async (req, res) => {
      const conn = requireConnection(req, res);
      if (!conn) return;
      const reservation = store.createReservation({
        chargerId: req.params.id,
        connectorId: Number(req.body.connectorId),
        idTag: req.body.idTag ?? 'RFID-0001',
        minutes: Number(req.body.minutes ?? 30),
      });
      try {
        const result: any = await conn.reserveNow(
          reservation.ocppReservationId,
          reservation.connectorId,
          reservation.idTag,
          reservation.expiresAt,
        );
        if (result?.status && result.status !== 'Accepted')
          store.cancelReservation(reservation.id);
        res.json({ reservation, result });
      } catch (e) {
        store.cancelReservation(reservation.id);
        throw e;
      }
    }),
  );
  api.post(
    '/reservations/:id/cancel',
    h(async (req, res) => {
      const reservation = store.getReservation(req.params.id);
      if (!reservation) return res.status(404).json({ error: 'Not found' });
      const conn = connections.get(reservation.chargerId);
      let result: unknown = { status: 'Offline' };
      if (conn) result = await conn.cancelReservation(reservation.ocppReservationId);
      store.cancelReservation(reservation.id);
      res.json({ result });
    }),
  );

  // ---------------------------------------------------------- transactions
  api.get('/transactions', (_req, res) => res.json(store.listTransactions()));
  api.get('/transactions.csv', (_req, res) =>
    sendCsv(
      res,
      'sessions.csv',
      toCsv(
        ['id', 'chargerId', 'connectorId', 'idTag', 'state', 'startedAt', 'endedAt', 'energyWh', 'cost', 'currency', 'stopReason'],
        store.listTransactions() as unknown as Record<string, unknown>[],
      ),
    ),
  );
  api.get('/invoices.csv', (_req, res) =>
    sendCsv(
      res,
      'invoices.csv',
      toCsv(
        ['number', 'transactionId', 'chargerId', 'tenantId', 'amount', 'currency', 'status', 'method', 'createdAt', 'paidAt'],
        store.listInvoices() as unknown as Record<string, unknown>[],
      ),
    ),
  );
  api.get('/cdrs.csv', (_req, res) => {
    const rows = store
      .listTransactions()
      .filter((t) => t.state === 'Ended')
      .map((t) => {
        const c = transactionToCdr(t);
        return {
          id: c.id,
          location: c.cdr_location.id,
          start: c.start_date_time,
          end: c.end_date_time,
          kwh: c.total_energy,
          hours: c.total_time,
          cost_excl_vat: c.total_cost.excl_vat,
          cost_incl_vat: c.total_cost.incl_vat,
          currency: c.currency,
        };
      });
    sendCsv(
      res,
      'cdrs.csv',
      toCsv(['id', 'location', 'start', 'end', 'kwh', 'hours', 'cost_excl_vat', 'cost_incl_vat', 'currency'], rows),
    );
  });

  // ----------------------------------------------------------------- logs
  api.get('/logs', (req, res) =>
    res.json(store.listLogs(req.query.chargerId as string | undefined)),
  );

  // ------------------------------------------ ISO 15118 Plug & Charge
  api.get('/contracts', (_req, res) => res.json(store.listContracts()));
  api.post('/contracts', operator, h((req, res) =>
    res.status(201).json(store.upsertContract(req.body)),
  ));
  api.put('/contracts/:emaid', operator, h((req, res) =>
    res.json(store.upsertContract({ ...req.body, emaid: req.params.emaid })),
  ));
  api.delete('/contracts/:emaid', operator, (req, res) => {
    store.deleteContract(req.params.emaid);
    res.status(204).end();
  });
  api.post('/chargers/:id/plug-and-charge', operator, h((req, res) => {
    store.setPlugAndCharge(req.params.id, Boolean(req.body.enabled));
    res.json(store.getCharger(req.params.id) ?? {});
  }));

  // ---------------------------------------------------- tokens (RFID/access)
  api.get('/tokens', (_req, res) => res.json(store.listTokens()));
  api.post(
    '/tokens',
    h((req, res) => res.status(201).json(store.upsertToken(req.body))),
  );
  api.put(
    '/tokens/:idTag',
    h((req, res) =>
      res.json(store.upsertToken({ ...req.body, idTag: req.params.idTag })),
    ),
  );
  api.delete('/tokens/:idTag', (req, res) => {
    store.deleteToken(req.params.idTag);
    res.status(204).end();
  });

  // --------------------------------------------------------------- tariffs
  api.get('/tariffs', (_req, res) => res.json(store.listTariffs()));
  api.post(
    '/tariffs',
    h((req, res) => res.status(201).json(store.upsertTariff(req.body))),
  );
  api.put(
    '/tariffs/:id',
    h((req, res) =>
      res.json(store.upsertTariff({ ...req.body, id: req.params.id })),
    ),
  );
  api.delete('/tariffs/:id', (req, res) => {
    const ok = store.deleteTariff(req.params.id);
    if (!ok)
      return res
        .status(400)
        .json({ error: 'Cannot delete the default tariff' });
    res.status(204).end();
  });

  return api;
}
