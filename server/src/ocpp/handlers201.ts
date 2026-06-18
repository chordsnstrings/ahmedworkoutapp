import type { ConnectorStatus } from '@ocpp/shared';
import { config } from '../config';
import { store } from '../store';
import type { HandlerMap } from './connection';

const nowIso = () => new Date().toISOString();

/** OCPP 2.0.1 connectorStatus → normalised dashboard status. */
const STATUS_MAP: Record<string, ConnectorStatus> = {
  Available: 'Available',
  Occupied: 'Occupied',
  Reserved: 'Reserved',
  Unavailable: 'Unavailable',
  Faulted: 'Faulted',
};

/** Authorize an OCPP 2.0.1 idToken — Plug & Charge (eMAID) or RFID. */
function authorizeIdToken(idToken: any): ReturnType<typeof store.authorize> {
  if (idToken?.type === 'eMAID')
    return store.authorizeContract(idToken.idToken);
  return store.authorize(idToken?.idToken);
}

function readSample(meterValue: any[], measurand: string): number | undefined {
  for (const mv of meterValue ?? []) {
    for (const sv of mv.sampledValue ?? []) {
      const m = sv.measurand ?? 'Energy.Active.Import.Register';
      if (m === measurand) {
        let v = Number(sv.value);
        const unit = sv.unitOfMeasure?.unit;
        if (unit === 'kWh' || unit === 'kW') v *= 1000;
        if (!Number.isNaN(v)) return v;
      }
    }
  }
  return undefined;
}

export const handlers201: HandlerMap = {
  BootNotification(conn, p) {
    const cs = p.chargingStation ?? {};
    store.upsertCharger(conn.id, {
      vendor: cs.vendorName,
      model: cs.model,
      serialNumber: cs.serialNumber,
      firmwareVersion: cs.firmwareVersion,
      bootReason: p.reason,
      state: 'Online',
      protocol: '2.0.1',
    });
    return {
      currentTime: nowIso(),
      interval: config.heartbeatInterval,
      status: 'Accepted',
    };
  },

  Heartbeat(conn) {
    store.markSeen(conn.id);
    return { currentTime: nowIso() };
  },

  StatusNotification(conn, p) {
    const connectorId = Number(p.evseId ?? p.connectorId ?? 1);
    store.setConnectorStatus(
      conn.id,
      connectorId,
      STATUS_MAP[p.connectorStatus] ?? 'Unknown',
    );
    return {};
  },

  Authorize(_conn, p) {
    const decision = authorizeIdToken(p.idToken);
    const res: Record<string, unknown> = { idTokenInfo: { status: decision } };
    // ISO 15118 certificate presented → acknowledge the contract certificate.
    if (p.certificate || p.iso15118CertificateHashData)
      res.certificateStatus = decision === 'Accepted' ? 'Accepted' : 'Rejected';
    return res;
  },

  /** ISO 15118 certificate installation/update during a Plug & Charge session. */
  Get15118EVCertificate(_conn, _p) {
    return { status: 'Accepted', exiResponse: '' };
  },

  TransactionEvent(conn, p) {
    const evseId = Number(p.evse?.id ?? 1);
    const txId = String(p.transactionInfo?.transactionId ?? p.transactionInfo?.id);
    const energy = readSample(p.meterValue, 'Energy.Active.Import.Register') ?? 0;
    const idTag = p.idToken?.idToken;

    if (p.eventType === 'Started') {
      const decision = authorizeIdToken(p.idToken);
      store.startTransaction({
        chargerId: conn.id,
        connectorId: evseId,
        idTag,
        meterStartWh: energy,
        transactionId: txId,
      });
      store.setConnectorStatus(conn.id, evseId, 'Charging');
      return { idTokenInfo: { status: decision === 'Invalid' ? 'Accepted' : decision } };
    }

    if (p.eventType === 'Updated') {
      store.updateTransactionMeter(txId, energy);
      const power = readSample(p.meterValue, 'Power.Active.Import');
      if (power != null) store.setConnectorPower(conn.id, evseId, power);
      return {};
    }

    if (p.eventType === 'Ended') {
      const tx = store.stopTransaction({
        transactionId: txId,
        meterStopWh: energy,
        reason: p.transactionInfo?.stoppedReason ?? p.triggerReason,
      });
      if (tx) store.setConnectorStatus(conn.id, evseId, 'Available');
      return {};
    }
    return {};
  },

  MeterValues(conn, p) {
    const evseId = Number(p.evseId ?? 1);
    const power = readSample(p.meterValue, 'Power.Active.Import');
    if (power != null) store.setConnectorPower(conn.id, evseId, power);
    return {};
  },

  DataTransfer(_conn, _p) {
    return { status: 'Accepted' };
  },

  FirmwareStatusNotification(conn, p) {
    if (p.status) store.setFirmwareStatus(conn.id, p.status);
    return {};
  },

  LogStatusNotification(conn, p) {
    if (p.status) store.setDiagnosticsStatus(conn.id, p.status);
    return {};
  },

  NotifyEvent(_conn, _p) {
    return {};
  },

  NotifyReport(_conn, _p) {
    return {};
  },
};
