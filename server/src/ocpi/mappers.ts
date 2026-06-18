import type { ChargerDTO, ConnectorStatus, TransactionDTO } from '@ocpp/shared';
import { config } from '../config';

/** Standard OCPI 2.2.1 response envelope. */
export function ocpiEnvelope<T>(data: T) {
  return {
    data,
    status_code: 1000,
    status_message: 'Success',
    timestamp: new Date().toISOString(),
  };
}

export function ocpiError(status_code: number, status_message: string) {
  return { status_code, status_message, timestamp: new Date().toISOString() };
}

const EVSE_STATUS: Record<ConnectorStatus, string> = {
  Available: 'AVAILABLE',
  Charging: 'CHARGING',
  Occupied: 'CHARGING',
  Preparing: 'CHARGING',
  Finishing: 'CHARGING',
  SuspendedEV: 'CHARGING',
  SuspendedEVSE: 'CHARGING',
  Reserved: 'RESERVED',
  Unavailable: 'INOPERATIVE',
  Faulted: 'OUTOFORDER',
  Unknown: 'UNKNOWN',
};

/** Map an internal charger to an OCPI Location with EVSEs and connectors. */
export function chargerToLocation(charger: ChargerDTO) {
  const lastUpdated = charger.lastSeen ?? new Date().toISOString();
  return {
    country_code: config.ocpiCountryCode,
    party_id: config.ocpiPartyId,
    id: charger.id,
    publish: true,
    name: `${charger.vendor ?? ''} ${charger.model ?? charger.id}`.trim(),
    address: charger.address ?? 'Unknown',
    city: charger.city ?? 'Unknown',
    country: 'USA',
    coordinates: {
      latitude: (charger.lat ?? 0).toFixed(6),
      longitude: (charger.lng ?? 0).toFixed(6),
    },
    evses: charger.connectors.map((c) => ({
      uid: `${charger.id}-${c.connectorId}`,
      evse_id: `${config.ocpiCountryCode}*${config.ocpiPartyId}*E${charger.id}${c.connectorId}`,
      status:
        charger.state === 'Offline'
          ? 'INOPERATIVE'
          : (EVSE_STATUS[c.status] ?? 'UNKNOWN'),
      connectors: [
        {
          id: String(c.connectorId),
          standard: 'IEC_62196_T2',
          format: 'SOCKET',
          power_type: 'AC_3_PHASE',
          max_voltage: 230,
          max_amperage: charger.powerLimitA ?? 32,
          last_updated: c.updatedAt,
        },
      ],
      last_updated: c.updatedAt,
    })),
    last_updated: lastUpdated,
  };
}

function token(tx: TransactionDTO) {
  return {
    uid: tx.idTag ?? 'anonymous',
    type: 'RFID',
    contract_id: tx.idTag ?? 'anonymous',
  };
}

export function transactionToSession(tx: TransactionDTO) {
  return {
    country_code: config.ocpiCountryCode,
    party_id: config.ocpiPartyId,
    id: tx.id,
    start_date_time: tx.startedAt,
    end_date_time: tx.endedAt,
    kwh: Math.round((tx.energyWh / 1000) * 1000) / 1000,
    cdr_token: token(tx),
    auth_method: 'WHITELIST',
    location_id: tx.chargerId,
    evse_uid: `${tx.chargerId}-${tx.connectorId}`,
    connector_id: String(tx.connectorId),
    currency: tx.currency ?? 'USD',
    status: tx.state === 'Active' ? 'ACTIVE' : 'COMPLETED',
    last_updated: tx.endedAt ?? tx.startedAt,
  };
}

/** Charge Detail Record — only meaningful for ended sessions. */
export function transactionToCdr(tx: TransactionDTO) {
  const minutes = tx.endedAt
    ? (Date.parse(tx.endedAt) - Date.parse(tx.startedAt)) / 60000
    : 0;
  const cost = tx.cost ?? 0;
  return {
    country_code: config.ocpiCountryCode,
    party_id: config.ocpiPartyId,
    id: `CDR-${tx.id}`,
    start_date_time: tx.startedAt,
    end_date_time: tx.endedAt,
    session_id: tx.id,
    cdr_token: token(tx),
    auth_method: 'WHITELIST',
    cdr_location: { id: tx.chargerId, evse_uid: `${tx.chargerId}-${tx.connectorId}` },
    currency: tx.currency ?? 'USD',
    total_cost: { excl_vat: cost, incl_vat: Math.round(cost * 1.2 * 100) / 100 },
    total_energy: Math.round((tx.energyWh / 1000) * 1000) / 1000,
    total_time: Math.round((minutes / 60) * 100) / 100,
    last_updated: tx.endedAt ?? tx.startedAt,
  };
}
