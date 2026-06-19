import type { ChargerDTO, TenantDTO, TransactionDTO } from '@ocpp/shared';

export interface Metrics {
  chargersTotal: number;
  chargersOnline: number;
  connectorsTotal: number;
  connectorsCharging: number;
  sessionsActive: number;
  sessionsToday: number;
  energyTodayWh: number;
  energyTotalWh: number;
  revenueToday: number;
  revenueTotal: number;
  byDay: { date: string; label: string; energyWh: number; revenue: number; sessions: number }[];
}

/** Percent change of the last `window` days vs the prior `window` days. */
export function trendPct(series: number[], window = 7): number {
  if (series.length < window * 2) return 0;
  const recent = series.slice(-window).reduce((a, b) => a + b, 0);
  const prior = series.slice(-window * 2, -window).reduce((a, b) => a + b, 0);
  if (prior === 0) return recent > 0 ? 100 : 0;
  return ((recent - prior) / prior) * 100;
}

/** Derive dashboard metrics from a (tenant-scoped) slice of live data. */
export function computeMetrics(
  chargers: ChargerDTO[],
  transactions: TransactionDTO[],
): Metrics {
  const todayKey = new Date().toISOString().slice(0, 10);
  const days = new Map<string, { energyWh: number; revenue: number; sessions: number }>();
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    days.set(key, { energyWh: 0, revenue: 0, sessions: 0 });
  }

  let energyTotal = 0;
  let revenueTotal = 0;
  let energyToday = 0;
  let revenueToday = 0;
  let sessionsToday = 0;

  for (const tx of transactions) {
    energyTotal += tx.energyWh;
    revenueTotal += tx.cost ?? 0;
    const key = tx.startedAt.slice(0, 10);
    const bucket = days.get(key);
    if (bucket) {
      bucket.energyWh += tx.energyWh;
      bucket.revenue += tx.cost ?? 0;
      bucket.sessions += 1;
    }
    if (key === todayKey) {
      energyToday += tx.energyWh;
      revenueToday += tx.cost ?? 0;
      sessionsToday++;
    }
  }

  const connectors = chargers.flatMap((c) => c.connectors);

  return {
    chargersTotal: chargers.length,
    chargersOnline: chargers.filter((c) => c.state === 'Online').length,
    connectorsTotal: connectors.length,
    connectorsCharging: connectors.filter((c) => c.status === 'Charging').length,
    sessionsActive: transactions.filter((t) => t.state === 'Active').length,
    sessionsToday,
    energyTodayWh: energyToday,
    energyTotalWh: energyTotal,
    revenueToday: Math.round(revenueToday * 100) / 100,
    revenueTotal: Math.round(revenueTotal * 100) / 100,
    byDay: [...days.entries()].map(([date, v]) => ({
      date,
      label: new Date(date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      energyWh: v.energyWh,
      revenue: Math.round(v.revenue * 100) / 100,
      sessions: v.sessions,
    })),
  };
}

export interface AdvancedMetrics {
  /** Connector busy-time over the last 7 days, as a percentage. */
  utilizationPct: number;
  avgKwh: number;
  avgDurationMin: number;
  /** Estimated CO2 avoided vs an equivalent ICE vehicle (kg). */
  co2Kg: number;
  peakKw: number;
  byHour: { hour: number; label: string; sessions: number; energyWh: number }[];
  byOperator: { id: string; name: string; energyWh: number; revenue: number; sessions: number }[];
}

/** Rough CO2 avoided per kWh delivered vs a comparable ICE car (kg/kWh). */
const CO2_KG_PER_KWH = 0.6;

export function computeAdvanced(
  chargers: ChargerDTO[],
  transactions: TransactionDTO[],
  tenants: TenantDTO[],
): AdvancedMetrics {
  const ended = transactions.filter((t) => t.state === 'Ended');
  const connectors = chargers.reduce((n, c) => n + Math.max(1, c.connectors.length), 0);

  const byHour = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}`,
    sessions: 0,
    energyWh: 0,
  }));

  const weekAgo = Date.now() - 7 * 86_400_000;
  let weekSessionMs = 0;
  let totalEnergy = 0;
  let totalDurMs = 0;
  let peakW = 0;

  const opMap = new Map<string, { energyWh: number; revenue: number; sessions: number }>();
  const chargerTenant = new Map(chargers.map((c) => [c.id, c.tenantId]));

  for (const t of ended) {
    const start = Date.parse(t.startedAt);
    const end = t.endedAt ? Date.parse(t.endedAt) : start;
    const h = byHour[new Date(start).getHours()];
    h.sessions++;
    h.energyWh += t.energyWh;
    totalEnergy += t.energyWh;
    totalDurMs += end - start;
    if (start >= weekAgo) weekSessionMs += end - start;
    for (const s of t.samples ?? []) peakW = Math.max(peakW, s.powerW);

    const tid = chargerTenant.get(t.chargerId) ?? 'unassigned';
    const o = opMap.get(tid) ?? { energyWh: 0, revenue: 0, sessions: 0 };
    o.energyWh += t.energyWh;
    o.revenue += t.cost ?? 0;
    o.sessions++;
    opMap.set(tid, o);
  }

  const utilizationPct =
    connectors > 0
      ? Math.min(100, Math.round((weekSessionMs / (connectors * 7 * 86_400_000)) * 1000) / 10)
      : 0;

  return {
    utilizationPct,
    avgKwh: ended.length ? Math.round((totalEnergy / ended.length / 1000) * 100) / 100 : 0,
    avgDurationMin: ended.length ? Math.round(totalDurMs / ended.length / 60000) : 0,
    co2Kg: Math.round((totalEnergy / 1000) * CO2_KG_PER_KWH),
    peakKw: Math.round((peakW / 1000) * 10) / 10,
    byHour,
    byOperator: [...opMap.entries()]
      .map(([id, v]) => ({
        id,
        name: tenants.find((t) => t.id === id)?.name ?? id,
        energyWh: v.energyWh,
        revenue: Math.round(v.revenue * 100) / 100,
        sessions: v.sessions,
      }))
      .sort((a, b) => b.energyWh - a.energyWh),
  };
}
