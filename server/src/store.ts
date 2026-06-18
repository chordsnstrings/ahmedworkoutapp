import { randomUUID } from 'node:crypto';
import type {
  AlertDTO,
  AlertSeverity,
  AnalyticsDTO,
  BrandingDTO,
  ChargerDTO,
  ConnectorDTO,
  ConfigKeyDTO,
  ConnectorStatus,
  ContractCertificateDTO,
  DriverDTO,
  ContractStatus,
  DemandResponseEventDTO,
  InvoiceDTO,
  LoadGroupDTO,
  LogEntryDTO,
  ReservationDTO,
  RoamingPartnerDTO,
  TariffDTO,
  TenantDTO,
  TokenDTO,
  TransactionDTO,
  WalletEntryDTO,
  WebhookDeliveryDTO,
  WebhookDTO,
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
  private loadGroups = new Map<string, LoadGroupDTO>();
  private demandResponse = new Map<string, DemandResponseEventDTO>();
  private reservations = new Map<string, ReservationDTO>();
  private invoices = new Map<string, InvoiceDTO>();
  private partners = new Map<string, RoamingPartnerDTO>();
  private contracts = new Map<string, ContractCertificateDTO>();
  private webhooks = new Map<string, WebhookDTO>();
  private deliveries: WebhookDeliveryDTO[] = [];
  private drivers = new Map<string, DriverDTO>();
  private wallet: WalletEntryDTO[] = [];
  private alerts: AlertDTO[] = [];
  private logs: LogEntryDTO[] = [];
  private ocppReservationSeq = 1000;
  private invoiceSeq = 1;

  /** Per-charger availability accounting for uptime % and fault counts. */
  private health = new Map<
    string,
    { sinceMs: number; onlineMs: number; lastMs: number; online: boolean; faults: number[] }
  >();

  /** New chargers land here until an operator claims them. */
  readonly defaultTenantId = 'unassigned';

  branding: BrandingDTO = {
    platformName: 'VoltGrid CSMS',
    accentColor: '#22d3ee',
    currency: config.defaultCurrency,
  };

  constructor() {
    this.seed();
    setInterval(() => this.expireReservations(), 30_000).unref();
    setInterval(() => this.tickDemandResponse(), 10_000).unref();
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

    this.drivers.set('drv-demo', {
      id: 'drv-demo',
      name: 'Alex Driver',
      email: 'alex@example.com',
      group: 'public',
      balance: 50,
      currency: config.defaultCurrency,
      tokenIds: ['RFID-0001'],
      createdAt: now,
    });

    for (const c of [
      { emaid: 'DE-8AA-CA12B34-9', holder: 'Demo EV (BMW)' },
      { emaid: 'NL-TNM-000000001-X', holder: 'Fleet vehicle' },
    ]) {
      this.contracts.set(c.emaid, {
        id: randomUUID(),
        emaid: c.emaid,
        holder: c.holder,
        status: 'Valid',
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
        lat: 40.712,
        lng: -74.006,
        address: '120 Broadway',
        city: 'New York',
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
        lat: 40.758,
        lng: -73.985,
        address: '1500 Broadway',
        city: 'New York',
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
        lat: 40.689,
        lng: -73.944,
        address: '500 Park Pl',
        city: 'Brooklyn',
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
        lat: c.lat,
        lng: c.lng,
        address: c.address,
        city: c.city,
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
        const invoice: InvoiceDTO = {
          id: randomUUID(),
          number: `INV-${String(this.invoiceSeq++).padStart(5, '0')}`,
          transactionId: id,
          chargerId: charger.id,
          tenantId: charger.tenantId ?? this.defaultTenantId,
          amount: cost,
          currency: tariff?.currency ?? config.defaultCurrency,
          status: Math.random() > 0.25 ? 'paid' : 'pending',
          method: 'card',
          createdAt: end.toISOString(),
          paidAt: end.toISOString(),
        };
        this.invoices.set(invoice.id, invoice);
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
    this.trackHealth(charger);
    this.decorate(charger);
    this.chargers.set(id, charger);
    bus.emitEvent({ type: 'charger', charger });
    this.pushAnalytics();
    return charger;
  }

  /** Accumulate online/offline time so we can report a rolling uptime %. */
  private trackHealth(charger: ChargerDTO) {
    const now = Date.now();
    const prev = this.health.get(charger.id);
    const online = charger.state === 'Online';
    if (!prev) {
      this.health.set(charger.id, {
        sinceMs: now,
        onlineMs: 0,
        lastMs: now,
        online,
        faults: [],
      });
      return;
    }
    if (prev.online) prev.onlineMs += now - prev.lastMs;
    prev.lastMs = now;
    prev.online = online;
  }

  private decorate(charger: ChargerDTO) {
    const h = this.health.get(charger.id);
    if (!h) return;
    const now = Date.now();
    const onlineMs = h.onlineMs + (h.online ? now - h.lastMs : 0);
    const span = Math.max(1, now - h.sinceMs);
    charger.uptimePct = Math.round((onlineMs / span) * 1000) / 10;
    const dayAgo = now - 86_400_000;
    charger.faults24h = h.faults.filter((t) => t > dayAgo).length;
  }

  getCharger(id: string) {
    const c = this.chargers.get(id);
    if (c) this.decorate(c);
    return c;
  }
  listChargers() {
    const list = [...this.chargers.values()];
    for (const c of list) this.decorate(c);
    return list;
  }

  // ----------------------------------------------------------------- tenants
  listTenants() {
    return [...this.tenants.values()];
  }
  assignTenant(chargerId: string, tenantId: string) {
    if (!this.tenants.has(tenantId) || !this.chargers.has(chargerId)) return;
    this.upsertCharger(chargerId, { tenantId });
  }
  setLocation(
    chargerId: string,
    loc: { lat?: number; lng?: number; address?: string; city?: string },
  ) {
    if (this.chargers.has(chargerId)) this.upsertCharger(chargerId, loc);
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
    const prev = idx >= 0 ? charger.connectors[idx] : undefined;
    if (idx >= 0)
      charger.connectors[idx] = { ...charger.connectors[idx], ...conn };
    else charger.connectors.push(conn);
    charger.connectors.sort((a, b) => a.connectorId - b.connectorId);
    this.upsertCharger(chargerId, { connectors: charger.connectors });

    if (status === 'Faulted' && prev?.status !== 'Faulted') {
      this.health.get(chargerId)?.faults.push(Date.now());
      this.raiseAlert(chargerId, 'critical', 'connector_fault',
        `Connector ${connectorId} faulted${errorCode ? ` (${errorCode})` : ''}`);
    }
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

  setConfig(chargerId: string, config: ConfigKeyDTO[]) {
    if (this.chargers.has(chargerId)) this.upsertCharger(chargerId, { config });
  }
  setFirmwareStatus(chargerId: string, firmwareStatus: string) {
    const c = this.chargers.get(chargerId);
    if (!c) return;
    this.upsertCharger(chargerId, { firmwareStatus });
    if (firmwareStatus === 'Installed' || firmwareStatus === 'Installing')
      this.raiseAlert(chargerId, 'info', 'firmware', `Firmware ${firmwareStatus}`);
  }
  setDiagnosticsStatus(chargerId: string, diagnosticsStatus: string) {
    if (this.chargers.has(chargerId))
      this.upsertCharger(chargerId, { diagnosticsStatus });
  }
  setLocalListVersion(chargerId: string, localListVersion: number) {
    if (this.chargers.has(chargerId))
      this.upsertCharger(chargerId, { localListVersion });
  }
  /** Accepted tokens to push as the offline local authorization list. */
  acceptedTokens() {
    return this.listTokens()
      .filter((t) => t.status === 'Accepted')
      .map((t) => ({ idTag: t.idTag, status: 'Accepted' }));
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
    this.raiseAlert(chargerId, 'warning', 'offline', 'Charge point went offline');
  }

  // ------------------------------------------------------------------ alerts
  raiseAlert(
    chargerId: string,
    severity: AlertSeverity,
    type: string,
    message: string,
  ): AlertDTO {
    const alert: AlertDTO = {
      id: randomUUID(),
      at: new Date().toISOString(),
      chargerId,
      severity,
      type,
      message,
      acknowledged: false,
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > 200) this.alerts.pop();
    bus.emitEvent({ type: 'alert', alert });
    return alert;
  }
  listAlerts() {
    return this.alerts;
  }
  ackAlert(id: string) {
    const a = this.alerts.find((x) => x.id === id);
    if (a) {
      a.acknowledged = true;
      bus.emitEvent({ type: 'alert', alert: a });
    }
    return a;
  }
  ackAllAlerts() {
    for (const a of this.alerts)
      if (!a.acknowledged) {
        a.acknowledged = true;
        bus.emitEvent({ type: 'alert', alert: a });
      }
  }

  // -------------------------------------------------------------- load groups
  listLoadGroups() {
    const list = [...this.loadGroups.values()];
    for (const g of list) this.decorateGroup(g);
    return list;
  }
  getLoadGroup(id: string) {
    const g = this.loadGroups.get(id);
    if (g) this.decorateGroup(g);
    return g;
  }
  upsertLoadGroup(input: Omit<LoadGroupDTO, 'id'> & { id?: string }): LoadGroupDTO {
    const id = input.id ?? randomUUID();
    const group: LoadGroupDTO = {
      id,
      tenantId: input.tenantId,
      name: input.name,
      limitKw: input.limitKw,
      voltage: input.voltage || 230,
      chargerIds: input.chargerIds ?? [],
      solarKw: input.solarKw ?? 0,
      batteryKw: input.batteryKw ?? 0,
      batterySoc: input.batterySoc ?? 0,
    };
    this.loadGroups.set(id, group);
    // Reflect membership back onto chargers.
    for (const c of this.chargers.values())
      if (group.chargerIds.includes(c.id)) c.loadGroupId = id;
      else if (c.loadGroupId === id) c.loadGroupId = undefined;
    this.decorateGroup(group);
    bus.emitEvent({ type: 'loadgroup', group });
    return group;
  }
  deleteLoadGroup(id: string) {
    for (const c of this.chargers.values())
      if (c.loadGroupId === id) c.loadGroupId = undefined;
    return this.loadGroups.delete(id);
  }
  loadGroupFor(chargerId: string) {
    return [...this.loadGroups.values()].find((g) =>
      g.chargerIds.includes(chargerId),
    );
  }
  /** Count active connectors and compute the effective (solar/DR-adjusted) budget. */
  private decorateGroup(group: LoadGroupDTO) {
    let active = 0;
    for (const id of group.chargerIds) {
      const c = this.chargers.get(id);
      if (c?.state !== 'Online') continue;
      active += c.connectors.filter((x) => x.status === 'Charging').length;
    }
    group.activeConnectors = active;

    const reduction = this.activeDrReduction(group.id);
    group.drActive = reduction > 0;
    const effective = Math.max(
      0,
      group.limitKw + (group.solarKw ?? 0) + (group.batteryKw ?? 0) - reduction,
    );
    group.effectiveLimitKw = Math.round(effective * 10) / 10;

    const totalA = (effective * 1000) / (group.voltage || 230);
    group.allocatedA =
      active > 0 ? Math.floor(totalA / active) : Math.floor(totalA);
  }

  // ------------------------------------------------------ demand response
  listDemandResponse() {
    return [...this.demandResponse.values()].sort((a, b) =>
      b.startsAt.localeCompare(a.startsAt),
    );
  }
  createDemandResponse(input: {
    groupId: string;
    name: string;
    type?: DemandResponseEventDTO['type'];
    magnitudeKw: number;
    minutes: number;
    startInMinutes?: number;
  }): DemandResponseEventDTO {
    const now = Date.now();
    const start = now + (input.startInMinutes ?? 0) * 60_000;
    const event: DemandResponseEventDTO = {
      id: randomUUID(),
      groupId: input.groupId,
      name: input.name,
      type: input.type ?? 'curtail',
      magnitudeKw: input.magnitudeKw,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + input.minutes * 60_000).toISOString(),
      status: start <= now ? 'active' : 'scheduled',
    };
    this.demandResponse.set(event.id, event);
    bus.emitEvent({ type: 'demandresponse', event });
    const group = this.getLoadGroup(event.groupId);
    if (group) bus.emitEvent({ type: 'loadgroup', group });
    return event;
  }
  cancelDemandResponse(id: string) {
    const e = this.demandResponse.get(id);
    if (e && e.status !== 'ended') {
      e.status = 'ended';
      e.endsAt = new Date().toISOString();
      bus.emitEvent({ type: 'demandresponse', event: e });
      const g = this.getLoadGroup(e.groupId);
      if (g) bus.emitEvent({ type: 'loadgroup', group: g });
    }
    return e;
  }
  /** Total kW currently being curtailed from a group by active DR events. */
  private activeDrReduction(groupId: string) {
    const now = Date.now();
    let total = 0;
    for (const e of this.demandResponse.values())
      if (
        e.groupId === groupId &&
        e.status === 'active' &&
        Date.parse(e.startsAt) <= now &&
        Date.parse(e.endsAt) > now
      )
        total += e.magnitudeKw;
    return total;
  }
  /** Activate/end DR events on their schedule and rebalance affected groups. */
  tickDemandResponse() {
    const now = Date.now();
    for (const e of this.demandResponse.values()) {
      const start = Date.parse(e.startsAt);
      const end = Date.parse(e.endsAt);
      let changed = false;
      if (e.status === 'scheduled' && start <= now && end > now) {
        e.status = 'active';
        changed = true;
      } else if (e.status !== 'ended' && end <= now) {
        e.status = 'ended';
        changed = true;
      }
      if (changed) {
        bus.emitEvent({ type: 'demandresponse', event: e });
        const g = this.getLoadGroup(e.groupId);
        if (g) bus.emitEvent({ type: 'loadgroup', group: g });
      }
    }
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
    const tariff = this.selectTariff(input.idTag);
    this.consumeReservation(input.chargerId, input.connectorId);
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
    this.recordMeter(transactionId, { meterWh });
  }

  /** Record a meter sample (energy + optional power/SoC/signed) on a session. */
  recordMeter(
    transactionId: string,
    input: { meterWh: number; powerW?: number; soc?: number; signed?: boolean },
  ) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.state !== 'Active') return;
    tx.energyWh = Math.max(0, input.meterWh - tx.meterStartWh);
    if (input.soc != null) tx.soc = input.soc;
    if (input.signed) tx.signed = true;
    if (!tx.samples) tx.samples = [];
    tx.samples.push({
      t: new Date().toISOString(),
      powerW: Math.round(input.powerW ?? 0),
      energyWh: tx.energyWh,
      soc: input.soc,
    });
    // Keep the series bounded so snapshots stay small.
    if (tx.samples.length > 180) tx.samples.shift();
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
    if ((tx.cost ?? 0) > 0) {
      this.createInvoice(tx);
      this.chargeWalletForSession(tx);
    }
    bus.emitEvent({ type: 'transaction', transaction: tx });
    this.pushAnalytics();
    return tx;
  }

  // ---------------------------------------------------------------- invoices
  private createInvoice(tx: TransactionDTO): InvoiceDTO {
    const charger = this.chargers.get(tx.chargerId);
    const invoice: InvoiceDTO = {
      id: randomUUID(),
      number: `INV-${String(this.invoiceSeq++).padStart(5, '0')}`,
      transactionId: tx.id,
      chargerId: tx.chargerId,
      tenantId: charger?.tenantId ?? this.defaultTenantId,
      amount: tx.cost ?? 0,
      currency: tx.currency ?? this.branding.currency,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.invoices.set(invoice.id, invoice);
    return invoice;
  }
  listInvoices() {
    return [...this.invoices.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  getInvoice(id: string) {
    return this.invoices.get(id);
  }
  markInvoicePaid(id: string, method: string) {
    const inv = this.invoices.get(id);
    if (!inv || inv.status === 'paid') return inv;
    inv.status = 'paid';
    inv.method = method;
    inv.paidAt = new Date().toISOString();
    return inv;
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

  /** Pick the tariff for a session: a group-specific tariff if the token has a
   *  matching group, otherwise the default. */
  private selectTariff(idTag?: string): TariffDTO | undefined {
    const group = idTag ? this.tokens.get(idTag)?.group : undefined;
    if (group) {
      const match = [...this.tariffs.values()].find(
        (t) => t.appliesToGroup === group,
      );
      if (match) return match;
    }
    return this.defaultTariff();
  }

  /** Energy price for a tariff at a given time, honouring time-of-use windows. */
  private energyPrice(tariff: TariffDTO, at: Date): number {
    const hour = at.getHours();
    const window = tariff.windows?.find((w) =>
      w.startHour <= w.endHour
        ? hour >= w.startHour && hour < w.endHour
        : hour >= w.startHour || hour < w.endHour,
    );
    return window?.pricePerKwh ?? tariff.pricePerKwh;
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
      kwh * this.energyPrice(tariff, new Date(tx.startedAt)) +
      hours * tariff.pricePerHour;
    return Math.round(cost * 100) / 100;
  }

  // ------------------------------------------------------------ reservations
  listReservations() {
    return [...this.reservations.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  getReservation(id: string) {
    return this.reservations.get(id);
  }
  createReservation(input: {
    chargerId: string;
    connectorId: number;
    idTag: string;
    minutes: number;
  }): ReservationDTO {
    const now = Date.now();
    const reservation: ReservationDTO = {
      id: randomUUID(),
      ocppReservationId: this.ocppReservationSeq++,
      chargerId: input.chargerId,
      connectorId: input.connectorId,
      idTag: input.idTag,
      status: 'Active',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + input.minutes * 60_000).toISOString(),
    };
    this.reservations.set(reservation.id, reservation);
    bus.emitEvent({ type: 'reservation', reservation });
    return reservation;
  }
  private setReservationStatus(id: string, status: ReservationDTO['status']) {
    const r = this.reservations.get(id);
    if (r && r.status === 'Active') {
      r.status = status;
      bus.emitEvent({ type: 'reservation', reservation: r });
    }
    return r;
  }
  cancelReservation(id: string) {
    return this.setReservationStatus(id, 'Cancelled');
  }
  /** When a session begins, mark any matching active reservation as used. */
  private consumeReservation(chargerId: string, connectorId: number) {
    for (const r of this.reservations.values())
      if (
        r.status === 'Active' &&
        r.chargerId === chargerId &&
        r.connectorId === connectorId
      )
        this.setReservationStatus(r.id, 'Used');
  }
  /** Expire reservations whose window has passed. */
  expireReservations() {
    const now = Date.now();
    for (const r of this.reservations.values())
      if (r.status === 'Active' && Date.parse(r.expiresAt) < now)
        this.setReservationStatus(r.id, 'Expired');
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

  // ----------------------------------------------- ISO 15118 Plug & Charge
  setPlugAndCharge(chargerId: string, enabled: boolean) {
    if (this.chargers.has(chargerId))
      this.upsertCharger(chargerId, { plugAndCharge: enabled });
  }
  listContracts() {
    return [...this.contracts.values()];
  }
  upsertContract(input: {
    id?: string;
    emaid: string;
    holder: string;
    status?: ContractStatus;
    validTo?: string;
  }): ContractCertificateDTO {
    const existing = this.contracts.get(input.emaid);
    const contract: ContractCertificateDTO = {
      id: existing?.id ?? randomUUID(),
      emaid: input.emaid,
      holder: input.holder,
      status: input.status ?? existing?.status ?? 'Valid',
      validTo: input.validTo ?? existing?.validTo,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.contracts.set(contract.emaid, contract);
    return contract;
  }
  deleteContract(emaid: string) {
    return this.contracts.delete(emaid);
  }
  /** Plug & Charge authorization decision for an ISO 15118 eMAID. */
  authorizeContract(emaid: string | undefined): 'Accepted' | 'Blocked' | 'Invalid' | 'Expired' {
    if (!emaid) return 'Invalid';
    const c = this.contracts.get(emaid);
    if (!c) return 'Invalid';
    if (c.status === 'Revoked') return 'Blocked';
    if (c.status === 'Expired' || (c.validTo && Date.parse(c.validTo) < Date.now()))
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

  // --------------------------------------------------------- roaming (OCPI)
  listPartners() {
    return [...this.partners.values()];
  }
  registerPartner(input: {
    name: string;
    role?: RoamingPartnerDTO['role'];
    countryCode?: string;
    partyId?: string;
    versionsUrl?: string;
  }): RoamingPartnerDTO {
    const partner: RoamingPartnerDTO = {
      id: randomUUID(),
      name: input.name,
      role: input.role ?? 'EMSP',
      countryCode: input.countryCode ?? 'DE',
      partyId: input.partyId ?? 'EMP',
      tokenIn: randomUUID().replace(/-/g, ''),
      versionsUrl: input.versionsUrl,
      status: 'registered',
      registeredAt: new Date().toISOString(),
    };
    this.partners.set(partner.id, partner);
    return partner;
  }
  deletePartner(id: string) {
    return this.partners.delete(id);
  }
  /** A partner is authorised if any registered partner owns the bearer token. */
  partnerByToken(token: string | undefined) {
    if (!token) return undefined;
    return [...this.partners.values()].find((p) => p.tokenIn === token);
  }

  // ------------------------------------------------ drivers & wallets
  listDrivers() {
    return [...this.drivers.values()];
  }
  getDriver(id: string) {
    return this.drivers.get(id);
  }
  upsertDriver(input: Partial<DriverDTO> & { name: string; id?: string }): DriverDTO {
    const id = input.id ?? randomUUID();
    const existing = this.drivers.get(id);
    const driver: DriverDTO = {
      id,
      name: input.name,
      email: input.email ?? existing?.email,
      group: input.group ?? existing?.group,
      balance: input.balance ?? existing?.balance ?? 0,
      currency: input.currency ?? existing?.currency ?? this.branding.currency,
      tokenIds: input.tokenIds ?? existing?.tokenIds ?? [],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.drivers.set(id, driver);
    return driver;
  }
  deleteDriver(id: string) {
    return this.drivers.delete(id);
  }
  topUpDriver(id: string, amount: number): DriverDTO | undefined {
    const d = this.drivers.get(id);
    if (!d) return;
    d.balance = Math.round((d.balance + amount) * 100) / 100;
    this.addWalletEntry(id, 'topup', amount, d.balance, 'Account top-up');
    return d;
  }
  driverForTag(idTag?: string) {
    if (!idTag) return undefined;
    return [...this.drivers.values()].find((d) => d.tokenIds.includes(idTag));
  }
  private addWalletEntry(
    driverId: string,
    type: WalletEntryDTO['type'],
    amount: number,
    balanceAfter: number,
    reference?: string,
  ) {
    this.wallet.unshift({
      id: randomUUID(),
      driverId,
      at: new Date().toISOString(),
      type,
      amount: Math.round(amount * 100) / 100,
      balanceAfter,
      reference,
    });
    if (this.wallet.length > 500) this.wallet.pop();
  }
  listWallet(driverId?: string) {
    return driverId ? this.wallet.filter((w) => w.driverId === driverId) : this.wallet;
  }
  /** Deduct a session cost from the owning driver's wallet, if any. */
  private chargeWalletForSession(tx: TransactionDTO) {
    const driver = this.driverForTag(tx.idTag);
    if (!driver || !tx.cost) return;
    driver.balance = Math.round((driver.balance - tx.cost) * 100) / 100;
    this.addWalletEntry(driver.id, 'charge', -tx.cost, driver.balance, `Session ${tx.id}`);
  }

  // ---------------------------------------------------- webhooks (notify)
  listWebhooks() {
    return [...this.webhooks.values()];
  }
  activeWebhooks() {
    return this.listWebhooks().filter((w) => w.active);
  }
  upsertWebhook(input: { id?: string; url: string; events?: WebhookDTO['events']; active?: boolean }): WebhookDTO {
    const id = input.id ?? randomUUID();
    const existing = this.webhooks.get(id);
    const webhook: WebhookDTO = {
      id,
      url: input.url,
      events: input.events ?? existing?.events ?? ['alert'],
      active: input.active ?? existing?.active ?? true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.webhooks.set(id, webhook);
    return webhook;
  }
  deleteWebhook(id: string) {
    return this.webhooks.delete(id);
  }
  getWebhook(id: string) {
    return this.webhooks.get(id);
  }
  recordDelivery(d: Omit<WebhookDeliveryDTO, 'id' | 'at'>) {
    const delivery: WebhookDeliveryDTO = { id: randomUUID(), at: new Date().toISOString(), ...d };
    this.deliveries.unshift(delivery);
    if (this.deliveries.length > 200) this.deliveries.pop();
    return delivery;
  }
  listDeliveries() {
    return this.deliveries;
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

  // ------------------------------------------------------------- audit log
  private audit: {
    id: string;
    at: string;
    user: string;
    role: string;
    action: string;
    target: string;
  }[] = [];

  addAudit(entry: { user: string; role: string; action: string; target: string }) {
    this.audit.unshift({ id: randomUUID(), at: new Date().toISOString(), ...entry });
    if (this.audit.length > 500) this.audit.pop();
  }
  listAudit() {
    return this.audit;
  }

  // ----------------------------------------------------------- persistence
  /** Serialise durable state to a plain object for snapshotting. */
  exportState() {
    return {
      version: 1,
      branding: this.branding,
      counters: {
        ocppReservationSeq: this.ocppReservationSeq,
        invoiceSeq: this.invoiceSeq,
      },
      chargers: [...this.chargers.values()],
      transactions: [...this.transactions.values()],
      tokens: [...this.tokens.values()],
      tariffs: [...this.tariffs.values()],
      contracts: [...this.contracts.values()],
      partners: [...this.partners.values()],
      invoices: [...this.invoices.values()],
      loadGroups: [...this.loadGroups.values()],
      demandResponse: [...this.demandResponse.values()],
      reservations: [...this.reservations.values()],
      tenants: [...this.tenants.values()],
      webhooks: [...this.webhooks.values()],
      drivers: [...this.drivers.values()],
      wallet: this.wallet,
      alerts: this.alerts,
      audit: this.audit,
    };
  }

  /** Restore durable state from a snapshot (replaces seeded data). */
  importState(s: ReturnType<Store['exportState']>) {
    if (!s || s.version !== 1) return;
    const fill = <T>(map: Map<string, T>, items: T[], key: (t: T) => string) => {
      map.clear();
      for (const it of items) map.set(key(it), it);
    };
    this.branding = s.branding ?? this.branding;
    this.ocppReservationSeq = s.counters?.ocppReservationSeq ?? this.ocppReservationSeq;
    this.invoiceSeq = s.counters?.invoiceSeq ?? this.invoiceSeq;
    fill(this.chargers, s.chargers ?? [], (c) => c.id);
    fill(this.transactions, s.transactions ?? [], (t) => t.id);
    fill(this.tokens, s.tokens ?? [], (t) => t.idTag);
    fill(this.tariffs, s.tariffs ?? [], (t) => t.id);
    fill(this.contracts, s.contracts ?? [], (c) => c.emaid);
    fill(this.partners, s.partners ?? [], (p) => p.id);
    fill(this.invoices, s.invoices ?? [], (i) => i.id);
    fill(this.loadGroups, s.loadGroups ?? [], (g) => g.id);
    fill(this.demandResponse, s.demandResponse ?? [], (d) => d.id);
    fill(this.reservations, s.reservations ?? [], (r) => r.id);
    if (s.tenants?.length) fill(this.tenants, s.tenants, (t) => t.id);
    fill(this.webhooks, s.webhooks ?? [], (w) => w.id);
    fill(this.drivers, s.drivers ?? [], (d) => d.id);
    this.wallet = s.wallet ?? [];
    this.alerts = s.alerts ?? [];
    this.audit = s.audit ?? [];
    // Reconnecting chargers are offline until they boot again.
    for (const c of this.chargers.values()) c.state = 'Offline';
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
