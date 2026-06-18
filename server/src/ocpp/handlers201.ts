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
    const decision = store.authorize(p.idToken?.idToken);
    return { idTokenInfo: { status: decision } };
  },

  TransactionEvent(conn, p) {
    const evseId = Number(p.evse?.id ?? 1);
    const txId = String(p.transactionInfo?.transactionId ?? p.transactionInfo?.id);
    const energy = readSample(p.meterValue, 'Energy.Active.Import.Register') ?? 0;
    const idTag = p.idToken?.idToken;

    if (p.eventType === 'Started') {
      const decision = store.authorize(idTag);
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
