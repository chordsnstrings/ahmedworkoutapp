import type { ChargerDTO, TransactionDTO } from '@ocpp/shared';

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
  byDay: { date: string; label: string; energyWh: number; revenue: number }[];
}

/** Derive dashboard metrics from a (tenant-scoped) slice of live data. */
export function computeMetrics(
  chargers: ChargerDTO[],
  transactions: TransactionDTO[],
): Metrics {
  const todayKey = new Date().toISOString().slice(0, 10);
  const days = new Map<string, { energyWh: number; revenue: number }>();
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    days.set(key, { energyWh: 0, revenue: 0 });
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
    })),
  };
}
