/**
 * Data-transfer objects shared between the CSMS server (REST/SSE) and the web dashboard.
 * These are the platform's *domain* model, deliberately version-agnostic so that the UI
 * does not care whether a charger speaks OCPP 1.6 or 2.0.1.
 */
import type { OcppVersion } from './rpc.js';

export type ConnectionState = 'Online' | 'Offline';

/** Normalised connector status across OCPP versions. */
export type ConnectorStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted'
  | 'Charging'
  | 'SuspendedEV'
  | 'SuspendedEVSE'
  | 'Finishing'
  | 'Preparing'
  | 'Unknown';

export interface ConnectorDTO {
  connectorId: number;
  status: ConnectorStatus;
  errorCode?: string;
  /** Instantaneous power in watts, if reported via MeterValues. */
  powerW?: number;
  updatedAt: string;
}

/** A Charge Point Operator (tenant) in the multi-tenant platform. */
export interface TenantDTO {
  id: string;
  name: string;
  accentColor: string;
  currency: string;
}

export interface ChargerDTO {
  id: string;
  tenantId: string;
  protocol: OcppVersion | null;
  state: ConnectionState;
  vendor?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  bootReason?: string;
  /** Operator-applied current limit in amps (Dynamic Load Management). */
  powerLimitA?: number;
  connectors: ConnectorDTO[];
  lastSeen?: string;
  connectedAt?: string;
}

export type TransactionState = 'Active' | 'Ended';

export interface TransactionDTO {
  id: string;
  chargerId: string;
  connectorId: number;
  idTag?: string;
  state: TransactionState;
  startedAt: string;
  endedAt?: string;
  meterStartWh: number;
  meterStopWh?: number;
  energyWh: number;
  /** Computed billing fields. */
  tariffId?: string;
  cost?: number;
  currency?: string;
  stopReason?: string;
}

export type TokenStatus = 'Accepted' | 'Blocked' | 'Expired';

/** RFID card / id-token for access control & authorization. */
export interface TokenDTO {
  idTag: string;
  label?: string;
  status: TokenStatus;
  group?: string;
  expiryDate?: string;
  createdAt: string;
}

/** Billing tariff applied to sessions. */
export interface TariffDTO {
  id: string;
  name: string;
  currency: string;
  /** Price per kWh of energy delivered. */
  pricePerKwh: number;
  /** Price per hour of connection/charging time. */
  pricePerHour: number;
  /** One-off session fee. */
  sessionFee: number;
  isDefault: boolean;
}

export type LogDirection = 'in' | 'out';

/** A single OCPP wire message, captured for the live monitor. */
export interface LogEntryDTO {
  id: string;
  at: string;
  chargerId: string;
  direction: LogDirection;
  /** CALL | CALLRESULT | CALLERROR */
  kind: string;
  action: string;
  messageId: string;
  payload: unknown;
}

export interface BrandingDTO {
  platformName: string;
  accentColor: string;
  currency: string;
}

export interface AnalyticsDTO {
  chargersTotal: number;
  chargersOnline: number;
  connectorsCharging: number;
  sessionsActive: number;
  sessionsToday: number;
  energyTodayWh: number;
  energyTotalWh: number;
  revenueToday: number;
  revenueTotal: number;
  currency: string;
  /** Last 14 days of energy (Wh) keyed by ISO date. */
  energyByDay: { date: string; energyWh: number; revenue: number }[];
}

/** Server-Sent-Events pushed to the dashboard for live updates. */
export type ServerEvent =
  | { type: 'charger'; charger: ChargerDTO }
  | { type: 'charger:removed'; chargerId: string }
  | { type: 'transaction'; transaction: TransactionDTO }
  | { type: 'log'; entry: LogEntryDTO }
  | { type: 'analytics'; analytics: AnalyticsDTO };

/** Remote command requests sent from the dashboard to a charger. */
export interface RemoteStartRequest {
  idTag: string;
  connectorId?: number;
}
export interface RemoteStopRequest {
  transactionId: string;
}
export interface ResetRequest {
  type: 'Soft' | 'Hard';
}
export interface ChangeAvailabilityRequest {
  connectorId: number;
  operative: boolean;
}
export interface SetPowerLimitRequest {
  connectorId: number;
  limitA: number;
}
export interface TriggerMessageRequest {
  requestedMessage: string;
  connectorId?: number;
}
