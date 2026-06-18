import type { ConnectorStatus } from '@ocpp/shared';
import { config } from '../config';
import { store } from '../store';
import type { HandlerMap } from './connection';

const nowIso = () => new Date().toISOString();

/** Pull a numeric sampledValue out of an OCPP 1.6 MeterValues array. */
function readSample(
  meterValue: any[],
  measurand: string,
  defaultMeasurand = false,
): number | undefined {
  for (const mv of meterValue ?? []) {
    for (const sv of mv.sampledValue ?? []) {
      const m = sv.measurand ?? 'Energy.Active.Import.Register';
      if (m === measurand || (defaultMeasurand && !sv.measurand)) {
        let v = Number(sv.value);
        if (sv.unit === 'kWh' || sv.unit === 'kW') v *= 1000;
        if (!Number.isNaN(v)) return v;
      }
    }
  }
  return undefined;
}

export const handlers16: HandlerMap = {
  BootNotification(conn, p) {
    store.upsertCharger(conn.id, {
      vendor: p.chargePointVendor,
      model: p.chargePointModel,
      serialNumber: p.chargePointSerialNumber ?? p.chargeBoxSerialNumber,
      firmwareVersion: p.firmwareVersion,
      state: 'Online',
      protocol: '1.6',
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
    store.setConnectorStatus(
      conn.id,
      Number(p.connectorId),
      (p.status as ConnectorStatus) ?? 'Unknown',
      p.errorCode && p.errorCode !== 'NoError' ? p.errorCode : undefined,
    );
    return {};
  },

  Authorize(_conn, p) {
    const decision = store.authorize(p.idTag);
    return { idTagInfo: { status: decision } };
  },

  StartTransaction(conn, p) {
    const decision = store.authorize(p.idTag);
    if (decision !== 'Accepted')
      return { transactionId: 0, idTagInfo: { status: decision } };
    const tx = store.startTransaction({
      chargerId: conn.id,
      connectorId: Number(p.connectorId),
      idTag: p.idTag,
      meterStartWh: Number(p.meterStart ?? 0),
    });
    store.setConnectorStatus(conn.id, Number(p.connectorId), 'Charging');
    return {
      transactionId: Number(tx.id),
      idTagInfo: { status: 'Accepted' },
    };
  },

  StopTransaction(conn, p) {
    const tx = store.stopTransaction({
      transactionId: String(p.transactionId),
      meterStopWh: Number(p.meterStop ?? 0),
      reason: p.reason,
    });
    if (tx) store.setConnectorStatus(conn.id, tx.connectorId, 'Available');
    return { idTagInfo: { status: 'Accepted' } };
  },

  MeterValues(conn, p) {
    const connectorId = Number(p.connectorId);
    const energy = readSample(
      p.meterValue,
      'Energy.Active.Import.Register',
      true,
    );
    const power = readSample(p.meterValue, 'Power.Active.Import');
    if (power != null) store.setConnectorPower(conn.id, connectorId, power);
    if (energy != null && p.transactionId != null)
      store.updateTransactionMeter(String(p.transactionId), energy);
    return {};
  },

  DataTransfer(_conn, _p) {
    return { status: 'Accepted' };
  },

  FirmwareStatusNotification(_conn, _p) {
    return {};
  },

  DiagnosticsStatusNotification(_conn, _p) {
    return {};
  },
};
