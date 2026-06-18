import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config';
import { store } from '../store';
import {
  chargerToLocation,
  ocpiEnvelope,
  ocpiError,
  transactionToCdr,
  transactionToSession,
} from './mappers';

const VERSION = '2.2.1';

/** Parse the `Authorization: Token <value>` header (value may be base64). */
function bearerToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (!header) return undefined;
  const raw = header.replace(/^Token\s+/i, '').trim();
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    // If it round-trips to printable ascii, treat as base64-encoded token.
    if (/^[\x20-\x7e]+$/.test(decoded) && decoded !== raw) return decoded;
  } catch {
    /* not base64 */
  }
  return raw;
}

/** Require a registered roaming partner's token on data endpoints. */
function ocpiAuth(req: Request, res: Response, next: NextFunction) {
  const partner = store.partnerByToken(bearerToken(req));
  if (!partner)
    return res.status(401).json(ocpiError(2001, 'Invalid or missing OCPI token'));
  (req as Request & { partner?: unknown }).partner = partner;
  next();
}

export function createOcpiRouter() {
  const ocpi = Router();
  const base = `${config.publicUrl.replace(/\/$/, '')}/ocpi`;

  // Version discovery (open, per OCPI registration flow).
  ocpi.get('/versions', (_req, res) =>
    res.json(ocpiEnvelope([{ version: VERSION, url: `${base}/${VERSION}` }])),
  );

  ocpi.get(`/${VERSION}`, (_req, res) =>
    res.json(
      ocpiEnvelope({
        version: VERSION,
        endpoints: [
          { identifier: 'credentials', role: 'SENDER', url: `${base}/${VERSION}/credentials` },
          { identifier: 'locations', role: 'SENDER', url: `${base}/${VERSION}/locations` },
          { identifier: 'sessions', role: 'SENDER', url: `${base}/${VERSION}/sessions` },
          { identifier: 'cdrs', role: 'SENDER', url: `${base}/${VERSION}/cdrs` },
          { identifier: 'tokens', role: 'RECEIVER', url: `${base}/${VERSION}/tokens` },
        ],
      }),
    ),
  );

  // Everything below requires a partner token.
  ocpi.use(ocpiAuth);

  ocpi.get(`/${VERSION}/credentials`, (_req, res) =>
    res.json(
      ocpiEnvelope({
        token: 'cpo-token',
        url: `${base}/versions`,
        roles: [
          {
            role: 'CPO',
            country_code: config.ocpiCountryCode,
            party_id: config.ocpiPartyId,
            business_details: { name: store.branding.platformName },
          },
        ],
      }),
    ),
  );

  // Locations module (CPO → eMSP).
  ocpi.get(`/${VERSION}/locations`, (_req, res) => {
    const data = store.listChargers().map(chargerToLocation);
    res.setHeader('X-Total-Count', String(data.length));
    res.json(ocpiEnvelope(data));
  });
  ocpi.get(`/${VERSION}/locations/:id`, (req, res) => {
    const charger = store.getCharger(req.params.id);
    if (!charger) return res.status(404).json(ocpiError(2003, 'Unknown location'));
    res.json(ocpiEnvelope(chargerToLocation(charger)));
  });

  // Sessions module.
  ocpi.get(`/${VERSION}/sessions`, (_req, res) =>
    res.json(ocpiEnvelope(store.listTransactions().map(transactionToSession))),
  );

  // CDRs module (ended sessions with cost).
  ocpi.get(`/${VERSION}/cdrs`, (_req, res) =>
    res.json(
      ocpiEnvelope(
        store
          .listTransactions()
          .filter((t) => t.state === 'Ended')
          .map(transactionToCdr),
      ),
    ),
  );

  // Tokens module — real-time authorization request from an eMSP.
  ocpi.post(`/${VERSION}/tokens/:tokenUid/authorize`, (req, res) => {
    const decision = store.authorize(req.params.tokenUid);
    res.json(
      ocpiEnvelope({
        allowed: decision === 'Accepted' ? 'ALLOWED' : 'NOT_ALLOWED',
        token: { uid: req.params.tokenUid, type: 'RFID' },
        authorization_reference: `auth-${Date.now()}`,
      }),
    );
  });

  return ocpi;
}
