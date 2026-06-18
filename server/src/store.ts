import { randomUUID } from 'node:crypto';
import type {
  AnalyticsDTO,
  BrandingDTO,
  ChargerDTO,
  ConnectorDTO,
  ConnectorStatus,
  LogEntryDTO,
  TariffDTO,
  TenantDTO,
  TokenDTO,
  TransactionDTO,
} from '@ocpp/shared';
import { config } from './config';
import { bus } from './events';

/**
 * In-memory domain store for the CSMS. A real deployment would back this with a
 * database (Postgres/Timescale); the rest of the platform only talks to this
 * interface, so swapping the persistence layer later is localised here.
 */
class Store {
  private chargers = new Map<string, ChargerDTO>();
  private transactions = new Map<string, TransactionDTO>();
  private tokens = new Map<string, TokenDTO>();
  private tariffs = new Map<string, TariffDTO>();
  private tenants = new Map<string, TenantDTO>();
  private logs: LogEntryDTO[] = [];

  /** New chargers land here until an operator claims them. */
  readonly defaultTenantId = 'unassigned';

  branding: BrandingDTO = {
    platformName: 'VoltGrid CSMS',
    accentColor: '#22d3ee',
    currency: config.defaultCurrency,
  };

  constructor() {
    this.seed();
  }

  private seed() {
    for (const t of [
      { id: 'metro', name: 'Metro EV Network', accentColor: '#22d3ee', currency: config.defaultCurrency },
      { id: 'greencharge', name: 'GreenCharge Co.', accentColor: '#34d399', currency: config.defaultCurrency },
      { id: 'unassigned', name: 'Unassigned', accentColor: '#64748b', currency: config.defaultCurrency },
    ] satisfies TenantDTO[]) {
      this.tenants.set(t.id, t);
    }

    const tariff: TariffDTO = {
      id: 'default',
      name: 'Standard',
      currency: config.defaultCurrency,
      pricePerKwh: 0.35,
      pricePerHour: 0,
      sessionFee: 0.5,
      isDefault: true,
    };
    this.tariffs.set(tariff.id, tariff);

    const now = new Date().toISOString();
    for (const t of [
      { idTag: 'RFID-0001', label: 'Demo Card', group: 'public' },
      { idTag: 'RFID-ADMIN', label: 'Admin Card', group: 'staff' },
    ]) {
      this.tokens.set(t.idTag, {
        ...t,
        status: 'Accepted',
        createdAt: now,
      });
    }

    this.seedDemo();
  }

  /** Pre-populate a few stations and historical sessions so the dashboard is
   *  meaningful before any real charge point or simulator connects. */
  private seedDemo() {
    const demoChargers: Array<Partial<ChargerDTO> & { id: string }> = [
      {
        id: 'METRO-DT-01',
        tenantId: 'metro',
        vendor: 'ABB',
        model: 'Terra 184',
        protocol: '2.0.1',
        firmwareVersion: '3.4.1',
        connectors: [
          { connectorId: 1, status: 'Available', updatedAt: new Date().toISOString() },
          { connectorId: 2, status: 'Available', updatedAt: new Date().toISOString() },
        ],
      },
      {
        id: 'METRO-MALL-07',
        tenantId: 'metro',
        vendor: 'Alpitronic',
        model: 'HYC300',
        protocol: '1.6',
        firmwareVersion: '1.9.0',
        connectors: [
          { connectorId: 1, status: 'Available', updatedAt: new Date().toISOString() },
        ],
      },
      {
        id: 'GREEN-PARK-03',
        tenantId: 'greencharge',
        vendor: 'Wallbox',
        model: 'Supernova',
        protocol: '1.6',
        firmwareVersion: '2.1.0',
        connectors: [
          { connectorId: 1, status: 'Available', updatedAt: new Date().toISOString() },
        ],
      },
    ];
    for (const c of demoChargers) {
      this.chargers.set(c.id, {
        id: c.id,
        tenantId: c.tenantId ?? this.defaultTenantId,
        protocol: c.protocol ?? null,
        state: 'Offline',
        connectors: c.connectors ?? [],
        vendor: c.vendor,
        model: c.model,
        firmwareVersion: c.firmwareVersion,
        lastSeen: new Date(Date.now() - 3_600_000).toISOString(),
      });
    }

    // Historical sessions across the last two weeks for charts & revenue.
    const tariff = this.defaultTariff();
    let seq = 1;
    for (let d = 13; d >= 0; d--) {
      const sessions = 2 + Math.floor(Math.random() * 4);
      for (let s = 0; s < sessions; s++) {
        const charger =
          demoChargers[Math.floor(Math.random() * demoChargers.length)];
        const start = new Date(
          Date.now() - d * 86_400_000 - Math.floor(Math.random() * 36_000_000),
        );
        const durationMs = 1_200_000 + Math.floor(Math.random() * 5_400_000);
        const energyWh = 8_000 + Math.floor(Math.random() * 42_000);
        const end = new Date(start.getTime() + durationMs);
        const id = `H${seq++}`;
        const kwh = energyWh / 1000;
        const cost = tariff
          ? Math.round(
              (tariff.sessionFee +
                kwh * tariff.pricePerKwh +
                (durationMs / 3_600_000) * tariff.pricePerHour) *
                100,
            ) / 100
          : 0;
        this.transactions.set(id, {
          id,
          chargerId: charger.id,
          connectorId: 1,
          idTag: 'RFID-0001',
          state: 'Ended',
          startedAt: start.toISOString(),
          endedAt: end.toISOString(),
          meterStartWh: 0,
          meterStopWh: energyWh,
          energyWh,
          tariffId: tariff?.id,
          cost,
          currency: tariff?.currency ?? config.defaultCurrency,
          stopReason: 'Local',
        });
      }
    }
  }

  // ---------------------------------------------------------------- chargers
  upsertCharger(id: string, patch: Partial<ChargerDTO>): ChargerDTO {
    const existing = this.chargers.get(id);
    const charger: ChargerDTO = {
      id,
      tenantId: this.defaultTenantId,
      protocol: null,
      state: 'Online',
      connectors: [],
      ...existing,
      ...patch,
    };
    this.chargers.set(id, charger);
    bus.emitEvent({ type: 'charger', charger });
    this.pushAnalytics();
    return charger;
  }

  getCharger(id: string) {
    return this.chargers.get(id);
  }
  listChargers() {
    return [...this.chargers.values()];
  }

  // ----------------------------------------------------------------- tenants
  listTenants() {
    return [...this.tenants.values()];
  }
  assignTenant(chargerId: string, tenantId: string) {
    if (!this.tenants.has(tenantId) || !this.chargers.has(chargerId)) return;
    this.upsertCharger(chargerId, { tenantId });
  }

  setConnectorStatus(
    chargerId: string,
    connectorId: number,
    status: ConnectorStatus,
    errorCode?: string,
  ) {
    const charger = this.chargers.get(chargerId);
    if (!charger) return;
    const conn: ConnectorDTO = {
      connectorId,
      status,
      errorCode,
      updatedAt: new Date().toISOString(),
    };
    const idx = charger.connectors.findIndex(
      (c) => c.connectorId === connectorId,
    );
    if (idx >= 0)
      charger.connectors[idx] = { ...charger.connectors[idx], ...conn };
    else charger.connectors.push(conn);
    charger.connectors.sort((a, b) => a.connectorId - b.connectorId);
    this.upsertCharger(chargerId, { connectors: charger.connectors });
  }

  setConnectorPower(chargerId: string, connectorId: number, powerW: number) {
    const charger = this.chargers.get(chargerId);
    if (!charger) return;
    const conn = charger.connectors.find((c) => c.connectorId === connectorId);
    if (conn) {
      conn.powerW = powerW;
      conn.updatedAt = new Date().toISOString();
      this.upsertCharger(chargerId, { connectors: charger.connectors });
    }
  }

  markSeen(chargerId: string) {
    const c = this.chargers.get(chargerId);
    if (c) this.upsertCharger(chargerId, { lastSeen: new Date().toISOString() });
  }

  setOffline(chargerId: string) {
    const c = this.chargers.get(chargerId);
    if (!c || c.state === 'Offline') return;
    for (const conn of c.connectors)
      if (conn.status === 'Charging') conn.status = 'Unavailable';
    this.upsertCharger(chargerId, {
      state: 'Offline',
      connectors: c.connectors,
    });
  }

  // ------------------------------------------------------------ transactions
  startTransaction(input: {
    chargerId: string;
    connectorId: number;
    idTag?: string;
    meterStartWh: number;
    transactionId?: string;
  }): TransactionDTO {
    const id = input.transactionId ?? String(Date.now() % 1_000_000_000);
    const tariff = this.defaultTariff();
    const tx: TransactionDTO = {
      id,
      chargerId: input.chargerId,
      connectorId: input.connectorId,
      idTag: input.idTag,
      state: 'Active',
      startedAt: new Date().toISOString(),
      meterStartWh: input.meterStartWh,
      energyWh: 0,
      tariffId: tariff?.id,
      currency: tariff?.currency ?? this.branding.currency,
    };
    this.transactions.set(id, tx);
    bus.emitEvent({ type: 'transaction', transaction: tx });
    this.pushAnalytics();
    return tx;
  }

  updateTransactionMeter(transactionId: string, meterWh: number) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.state !== 'Active') return;
    tx.energyWh = Math.max(0, meterWh - tx.meterStartWh);
    bus.emitEvent({ type: 'transaction', transaction: tx });
  }

  stopTransaction(input: {
    transactionId: string;
    meterStopWh: number;
    reason?: string;
  }): TransactionDTO | undefined {
    const tx = this.transactions.get(input.transactionId);
    if (!tx) return;
    tx.state = 'Ended';
    tx.endedAt = new Date().toISOString();
    tx.meterStopWh = input.meterStopWh;
    tx.energyWh = Math.max(0, input.meterStopWh - tx.meterStartWh);
    tx.stopReason = input.reason;
    tx.cost = this.computeCost(tx);
    this.transactions.set(tx.id, tx);
    bus.emitEvent({ type: 'transaction', transaction: tx });
    this.pushAnalytics();
    return tx;
  }

  getTransaction(id: string) {
    return this.transactions.get(id);
  }
  listTransactions() {
    return [...this.transactions.values()].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
  }
  activeTransactionFor(chargerId: string, connectorId?: number) {
    return [...this.transactions.values()].find(
      (t) =>
        t.state === 'Active' &&
        t.chargerId === chargerId &&
        (connectorId == null || t.connectorId === connectorId),
    );
  }

  private computeCost(tx: TransactionDTO): number {
    const tariff = tx.tariffId ? this.tariffs.get(tx.tariffId) : undefined;
    if (!tariff) return 0;
    const kwh = tx.energyWh / 1000;
    const hours =
      tx.endedAt && tx.startedAt
        ? (Date.parse(tx.endedAt) - Date.parse(tx.startedAt)) / 3_600_000
        : 0;
    const cost =
      tariff.sessionFee +
      kwh * tariff.pricePerKwh +
      hours * tariff.pricePerHour;
    return Math.round(cost * 100) / 100;
  }

  // ------------------------------------------------------------------ tokens
  listTokens() {
    return [...this.tokens.values()];
  }
  getToken(idTag: string) {
    return this.tokens.get(idTag);
  }
  upsertToken(t: Omit<TokenDTO, 'createdAt'> & { createdAt?: string }): TokenDTO {
    const token: TokenDTO = {
      ...t,
      createdAt: this.tokens.get(t.idTag)?.createdAt ?? new Date().toISOString(),
    };
    this.tokens.set(token.idTag, token);
    return token;
  }
  deleteToken(idTag: string) {
    return this.tokens.delete(idTag);
  }

  /** Authorization decision used by Authorize / StartTransaction / RequestStart. */
  authorize(idTag: string | undefined): 'Accepted' | 'Blocked' | 'Invalid' | 'Expired' {
    if (!idTag) return 'Invalid';
    const token = this.tokens.get(idTag);
    if (!token) return 'Invalid';
    if (token.status === 'Blocked') return 'Blocked';
    if (token.expiryDate && Date.parse(token.expiryDate) < Date.now())
      return 'Expired';
    return 'Accepted';
  }

  // ----------------------------------------------------------------- tariffs
  listTariffs() {
    return [...this.tariffs.values()];
  }
  defaultTariff() {
    return [...this.tariffs.values()].find((t) => t.isDefault);
  }
  upsertTariff(t: Omit<TariffDTO, 'id'> & { id?: string }): TariffDTO {
    const id = t.id ?? randomUUID();
    const tariff: TariffDTO = { ...t, id };
    if (tariff.isDefault)
      for (const other of this.tariffs.values())
        if (other.id !== id) other.isDefault = false;
    this.tariffs.set(id, tariff);
    return tariff;
  }
  deleteTariff(id: string) {
    const t = this.tariffs.get(id);
    if (t?.isDefault) return false; // never delete the default tariff
    return this.tariffs.delete(id);
  }

  // -------------------------------------------------------------------- logs
  addLog(entry: Omit<LogEntryDTO, 'id' | 'at'>): LogEntryDTO {
    const full: LogEntryDTO = {
      ...entry,
      id: randomUUID(),
      at: new Date().toISOString(),
    };
    this.logs.push(full);
    if (this.logs.length > config.maxLogEntries) this.logs.shift();
    bus.emitEvent({ type: 'log', entry: full });
    return full;
  }
  listLogs(chargerId?: string) {
    const l = chargerId
      ? this.logs.filter((e) => e.chargerId === chargerId)
      : this.logs;
    return [...l].reverse();
  }

  // -------------------------------------------------------------- analytics
  analytics(): AnalyticsDTO {
    const chargers = this.listChargers();
    const txs = this.listTransactions();
    const todayKey = new Date().toISOString().slice(0, 10);

    let energyTotal = 0;
    let energyToday = 0;
    let revenueTotal = 0;
    let revenueToday = 0;
    let sessionsToday = 0;
    const byDay = new Map<string, { energyWh: number; revenue: number }>();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      byDay.set(d, { energyWh: 0, revenue: 0 });
    }

    for (const tx of txs) {
      energyTotal += tx.energyWh;
      revenueTotal += tx.cost ?? 0;
      const day = tx.startedAt.slice(0, 10);
      const bucket = byDay.get(day);
      if (bucket) {
        bucket.energyWh += tx.energyWh;
        bucket.revenue += tx.cost ?? 0;
      }
      if (day === todayKey) {
        energyToday += tx.energyWh;
        revenueToday += tx.cost ?? 0;
        sessionsToday++;
      }
    }

    return {
      chargersTotal: chargers.length,
      chargersOnline: chargers.filter((c) => c.state === 'Online').length,
      connectorsCharging: chargers
        .flatMap((c) => c.connectors)
        .filter((c) => c.status === 'Charging').length,
      sessionsActive: txs.filter((t) => t.state === 'Active').length,
      sessionsToday,
      energyTodayWh: energyToday,
      energyTotalWh: energyTotal,
      revenueToday: Math.round(revenueToday * 100) / 100,
      revenueTotal: Math.round(revenueTotal * 100) / 100,
      currency: this.branding.currency,
      energyByDay: [...byDay.entries()].map(([date, v]) => ({
        date,
        energyWh: v.energyWh,
        revenue: Math.round(v.revenue * 100) / 100,
      })),
    };
  }

  private analyticsTimer: NodeJS.Timeout | null = null;
  private pushAnalytics() {
    // Debounce so a burst of updates produces a single analytics broadcast.
    if (this.analyticsTimer) return;
    this.analyticsTimer = setTimeout(() => {
      this.analyticsTimer = null;
      bus.emitEvent({ type: 'analytics', analytics: this.analytics() });
    }, 250);
  }
}

export const store = new Store();
