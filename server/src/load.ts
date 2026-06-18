import { bus } from './events';
import { log } from './logger';
import { store } from './store';
import { connections } from './ocpp/server';

/**
 * Dynamic Load Management. Keeps every load group within its kW budget by
 * dividing the available current across the connectors that are actively
 * charging and pushing a SetChargingProfile to each one (OCPP smart charging).
 */
const debounce = new Map<string, NodeJS.Timeout>();

function rebalance(groupId: string) {
  const group = store.getLoadGroup(groupId);
  if (!group) return;

  const charging: { chargerId: string; connectorId: number }[] = [];
  for (const id of group.chargerIds) {
    const charger = store.getCharger(id);
    if (charger?.state !== 'Online') continue;
    for (const conn of charger.connectors)
      if (conn.status === 'Charging')
        charging.push({ chargerId: id, connectorId: conn.connectorId });
  }

  // Use the effective budget (solar + battery, minus active demand response).
  const budgetKw = group.effectiveLimitKw ?? group.limitKw;
  const totalA = (budgetKw * 1000) / (group.voltage || 230);
  const perConnectorA = charging.length
    ? Math.max(6, Math.floor(totalA / charging.length))
    : Math.floor(totalA);

  for (const { chargerId, connectorId } of charging) {
    const conn = connections.get(chargerId);
    if (!conn) continue;
    conn
      .setPowerLimit(connectorId, perConnectorA)
      .catch((e) => log.warn(`DLM ${chargerId}: ${(e as Error).message}`));
    store.upsertCharger(chargerId, { powerLimitA: perConnectorA });
  }

  if (charging.length)
    log.info(
      `DLM "${group.name}": ${budgetKw}kW${group.drActive ? ' (DR active)' : ''} ÷ ${charging.length} → ${perConnectorA}A each`,
    );
}

function scheduleRebalance(groupId: string) {
  clearTimeout(debounce.get(groupId));
  debounce.set(
    groupId,
    setTimeout(() => rebalance(groupId), 500),
  );
}

export function startLoadManager() {
  bus.onEvent((e) => {
    if (e.type === 'transaction') {
      const group = store.loadGroupFor(e.transaction.chargerId);
      if (group) scheduleRebalance(group.id);
    } else if (e.type === 'loadgroup') {
      scheduleRebalance(e.group.id);
    }
  });
  log.info('Dynamic Load Manager started');
}
