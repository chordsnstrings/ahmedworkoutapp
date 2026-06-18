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
  /** Load group this charger belongs to, if any. */
  loadGroupId?: string;
  connectors: ConnectorDTO[];
  lastSeen?: string;
  connectedAt?: string;
  /** Rolling availability percentage since first seen. */
  uptimePct?: number;
  /** Faults reported in the last 24 hours. */
  faults24h?: number;
  /** Cached configuration keys from the last GetConfiguration/GetVariables. */
  config?: ConfigKeyDTO[];
  /** Latest firmware update status (FirmwareStatusNotification). */
  firmwareStatus?: string;
  /** Latest diagnostics/log upload status. */
  diagnosticsStatus?: string;
  /** Whether the charger is enrolled for ISO 15118 Plug & Charge. */
  plugAndCharge?: boolean;
  /** Version of the local authorization list installed on the charger. */
  localListVersion?: number;
  /** Site location (for the station map and OCPI Locations). */
  lat?: number;
  lng?: number;
  address?: string;
  city?: string;
}

export interface ConfigKeyDTO {
  key: string;
  value?: string;
  readonly?: boolean;
}

/** A site/circuit with a shared power budget shared across its chargers (DLM). */
export interface LoadGroupDTO {
  id: string;
  tenantId: string;
  name: string;
  /** Total power budget for the group in kW. */
  limitKw: number;
  /** Nominal supply voltage used to convert kW ↔ amps. */
  voltage: number;
  chargerIds: string[];
  /** On-site solar generation available to the group (kW). */
  solarKw?: number;
  /** On-site battery discharge available to the group (kW). */
  batteryKw?: number;
  /** Battery state of charge (%). */
  batterySoc?: number;
  /** Amps currently allocated to each charging connector (computed). */
  allocatedA?: number;
  /** Number of connectors actively drawing from the budget (computed). */
  activeConnectors?: number;
  /** Budget after solar, battery and any active demand-response curtailment (kW). */
  effectiveLimitKw?: number;
  /** True when a demand-response event is curtailing this group now. */
  drActive?: boolean;
}

export type DemandResponseType = 'curtail' | 'v2g';
export type DemandResponseStatus = 'scheduled' | 'active' | 'ended';

/** A grid demand-response event that curtails (or reverses, V2G) a group. */
export interface DemandResponseEventDTO {
  id: string;
  groupId: string;
  name: string;
  type: DemandResponseType;
  /** kW to shed from the group's budget (curtail) or discharge (v2g). */
  magnitudeKw: number;
  startsAt: string;
  endsAt: string;
  status: DemandResponseStatus;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertDTO {
  id: string;
  at: string;
  chargerId: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  acknowledged: boolean;
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
  /** Latest reported battery state of charge (%). */
  soc?: number;
  /** True once at least one signed meter value was received. */
  signed?: boolean;
  /** Time series of meter samples captured during the session. */
  samples?: MeterSample[];
  /** Computed billing fields. */
  tariffId?: string;
  cost?: number;
  currency?: string;
  stopReason?: string;
}

export interface MeterSample {
  t: string;
  powerW: number;
  energyWh: number;
  soc?: number;
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

/** A time-of-use pricing window (overrides the base energy price). */
export interface TariffWindow {
  /** Local hour the window starts (0–23). */
  startHour: number;
  /** Local hour the window ends (1–24, exclusive). */
  endHour: number;
  pricePerKwh: number;
  label?: string;
}

/** Billing tariff applied to sessions. */
export interface TariffDTO {
  id: string;
  name: string;
  currency: string;
  /** Base price per kWh of energy delivered. */
  pricePerKwh: number;
  /** Price per hour of connection/charging time. */
  pricePerHour: number;
  /** One-off session fee. */
  sessionFee: number;
  isDefault: boolean;
  /** Time-of-use windows; the matching window's price overrides the base. */
  windows?: TariffWindow[];
  /** If set, this tariff applies to tokens in this access group. */
  appliesToGroup?: string;
}

export type ContractStatus = 'Valid' | 'Revoked' | 'Expired';

/** An ISO 15118 contract certificate (Plug & Charge), keyed by eMAID. */
export interface ContractCertificateDTO {
  id: string;
  emaid: string;
  holder: string;
  status: ContractStatus;
  validTo?: string;
  createdAt: string;
}

export type ReservationStatus = 'Active' | 'Expired' | 'Cancelled' | 'Used';

export interface ReservationDTO {
  id: string;
  /** Numeric id sent to the charge point over OCPP. */
  ocppReservationId: number;
  chargerId: string;
  connectorId: number;
  idTag: string;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;
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

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** If set, the user is scoped to a single operator (tenant). */
  tenantId?: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
}

export type InvoiceStatus = 'pending' | 'paid' | 'refunded';

export interface InvoiceDTO {
  id: string;
  number: string;
  transactionId: string;
  chargerId: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  method?: string;
  createdAt: string;
  paidAt?: string;
}

/** An OCPI 2.2.1 roaming partner (eMSP or hub) we exchange data with. */
export interface RoamingPartnerDTO {
  id: string;
  name: string;
  role: 'EMSP' | 'HUB' | 'CPO';
  countryCode: string;
  partyId: string;
  /** Token the partner presents when calling our OCPI endpoints. */
  tokenIn: string;
  /** The partner's OCPI versions URL (for outbound calls). */
  versionsUrl?: string;
  status: 'registered' | 'pending';
  registeredAt: string;
}

export interface RoamingInfoDTO {
  versionsUrl: string;
  versionDetailUrl: string;
  countryCode: string;
  partyId: string;
  locations: number;
  sessions: number;
  cdrs: number;
  partners: number;
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
  | { type: 'analytics'; analytics: AnalyticsDTO }
  | { type: 'alert'; alert: AlertDTO }
  | { type: 'loadgroup'; group: LoadGroupDTO }
  | { type: 'reservation'; reservation: ReservationDTO }
  | { type: 'demandresponse'; event: DemandResponseEventDTO };

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
