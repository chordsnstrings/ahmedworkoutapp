import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Gauge,
  Play,
  Power,
  RotateCcw,
  Square,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { useLive } from '../store/live';
import { dateTime, duration, kwh, money, timeAgo } from '../lib/format';
import {
  ConnectorBadge,
  EmptyState,
  PageHeader,
  StateBadge,
} from '../components/ui';

export function ChargerDetail() {
  const { id = '' } = useParams();
  const { chargers, transactions, tenants, branding } = useLive();
  const charger = chargers.find((c) => c.id === id);

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [idTag, setIdTag] = useState('RFID-0001');
  const [connectorId, setConnectorId] = useState(1);
  const [limitA, setLimitA] = useState(16);

  const sessions = useMemo(
    () => transactions.filter((t) => t.chargerId === id),
    [transactions, id],
  );
  const activeTx = sessions.find((t) => t.state === 'Active');

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    setToast(null);
    try {
      const res: any = await fn();
      const status = res?.status ? ` · ${res.status}` : '';
      setToast({ ok: true, msg: `${action} sent${status}` });
    } catch (e) {
      setToast({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!charger) {
    return (
      <>
        <BackLink />
        <EmptyState title="Charge point not found" hint={`No station with id "${id}".`} />
      </>
    );
  }

  const online = charger.state === 'Online';

  return (
    <>
      <BackLink />
      <PageHeader
        title={charger.id}
        subtitle={`${charger.vendor ?? 'Unknown'} ${charger.model ?? ''} · FW ${charger.firmwareVersion ?? 'n/a'}`}
        actions={<StateBadge online={online} />}
      />

      {toast && (
        <div
          className={`mb-4 text-sm rounded-lg px-4 py-2.5 ${
            toast.ok
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-300 border border-red-500/20'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: info + connectors + sessions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4 sm:p-5">
            <h2 className="font-semibold text-white mb-3">Station</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
              <Field label="Protocol" value={charger.protocol ? `OCPP ${charger.protocol}` : '—'} />
              <Field label="Serial" value={charger.serialNumber ?? '—'} />
              <Field label="Last seen" value={timeAgo(charger.lastSeen)} />
              <Field label="Boot reason" value={charger.bootReason ?? '—'} />
              <Field
                label="Power limit"
                value={charger.powerLimitA ? `${charger.powerLimitA} A` : 'Unset'}
              />
              <Field
                label="Operator"
                value={
                  <select
                    value={charger.tenantId}
                    onChange={(e) =>
                      run('Assign operator', () =>
                        api.post(`/chargers/${id}/tenant`, {
                          tenantId: e.target.value,
                        }),
                      )
                    }
                    className="input py-1 text-sm"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                }
              />
            </dl>
          </div>

          <div className="card p-4 sm:p-5">
            <h2 className="font-semibold text-white mb-3">Connectors</h2>
            {charger.connectors.length === 0 ? (
              <p className="text-sm text-slate-500">No connectors reported yet.</p>
            ) : (
              <div className="space-y-2">
                {charger.connectors.map((conn) => (
                  <div
                    key={conn.connectorId}
                    className="flex items-center justify-between rounded-lg border border-ink-600/60 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-slate-400">
                        C{conn.connectorId}
                      </span>
                      <ConnectorBadge status={conn.status} />
                      {conn.errorCode && (
                        <span className="text-xs text-red-300">{conn.errorCode}</span>
                      )}
                    </div>
                    <div className="text-sm font-mono text-accent">
                      {conn.powerW ? `${(conn.powerW / 1000).toFixed(1)} kW` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4 sm:p-5">
            <h2 className="font-semibold text-white mb-3">Sessions</h2>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500">No sessions recorded.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase">
                      <th className="font-semibold px-1 py-2">Started</th>
                      <th className="font-semibold px-1 py-2">Duration</th>
                      <th className="font-semibold px-1 py-2">Energy</th>
                      <th className="font-semibold px-1 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-600/40">
                    {sessions.slice(0, 12).map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-1 py-2 text-slate-300">
                          {dateTime(tx.startedAt)}
                        </td>
                        <td className="px-1 py-2 text-slate-400">
                          {duration(tx.startedAt, tx.endedAt)}
                        </td>
                        <td className="px-1 py-2 text-slate-300">{kwh(tx.energyWh)}</td>
                        <td className="px-1 py-2 text-right">
                          {tx.state === 'Active' ? (
                            <span className="text-accent">live</span>
                          ) : (
                            money(tx.cost, tx.currency ?? branding.currency)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: command panel */}
        <div className="space-y-4">
          <div className="card p-4 sm:p-5">
            <h2 className="font-semibold text-white mb-3">Remote control</h2>
            {!online && (
              <p className="text-xs text-amber-300 mb-3">
                Station is offline — commands will fail until it reconnects.
              </p>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="label">ID tag</span>
                  <input
                    value={idTag}
                    onChange={(e) => setIdTag(e.target.value)}
                    className="input mt-1"
                  />
                </label>
                <label className="block">
                  <span className="label">Connector</span>
                  <input
                    type="number"
                    min={1}
                    value={connectorId}
                    onChange={(e) => setConnectorId(Number(e.target.value))}
                    className="input mt-1"
                  />
                </label>
              </div>

              <button
                disabled={!online || busy != null}
                onClick={() =>
                  run('Remote start', () =>
                    api.post(`/chargers/${id}/remote-start`, { idTag, connectorId }),
                  )
                }
                className="btn-primary w-full justify-center"
              >
                <Play size={16} /> Remote start
              </button>

              <button
                disabled={!online || busy != null || !activeTx}
                onClick={() =>
                  run('Remote stop', () =>
                    api.post(`/chargers/${id}/remote-stop`, {
                      transactionId: activeTx?.id,
                    }),
                  )
                }
                className="btn-ghost w-full justify-center"
              >
                <Square size={16} /> Remote stop
                {activeTx ? ` (tx ${activeTx.id})` : ''}
              </button>

              <div className="border-t border-ink-600/50 pt-3 space-y-3">
                <div className="flex items-end gap-2">
                  <label className="block flex-1">
                    <span className="label">Current limit (A)</span>
                    <input
                      type="number"
                      min={6}
                      value={limitA}
                      onChange={(e) => setLimitA(Number(e.target.value))}
                      className="input mt-1"
                    />
                  </label>
                  <button
                    disabled={!online || busy != null}
                    onClick={() =>
                      run('Set power limit', () =>
                        api.post(`/chargers/${id}/power-limit`, {
                          connectorId,
                          limitA,
                        }),
                      )
                    }
                    className="btn-ghost"
                  >
                    <Gauge size={16} /> Apply
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={!online || busy != null}
                    onClick={() =>
                      run('Change availability', () =>
                        api.post(`/chargers/${id}/availability`, {
                          connectorId,
                          operative: false,
                        }),
                      )
                    }
                    className="btn-ghost justify-center"
                  >
                    <Power size={16} /> Disable
                  </button>
                  <button
                    disabled={!online || busy != null}
                    onClick={() =>
                      run('Change availability', () =>
                        api.post(`/chargers/${id}/availability`, {
                          connectorId,
                          operative: true,
                        }),
                      )
                    }
                    className="btn-ghost justify-center"
                  >
                    <Power size={16} /> Enable
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={!online || busy != null}
                    onClick={() =>
                      run('Soft reset', () =>
                        api.post(`/chargers/${id}/reset`, { type: 'Soft' }),
                      )
                    }
                    className="btn-ghost justify-center"
                  >
                    <RotateCcw size={16} /> Soft reset
                  </button>
                  <button
                    disabled={!online || busy != null}
                    onClick={() =>
                      run('Hard reset', () =>
                        api.post(`/chargers/${id}/reset`, { type: 'Hard' }),
                      )
                    }
                    className="btn-danger justify-center"
                  >
                    <Zap size={16} /> Hard reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link
      to="/chargers"
      className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-accent mb-2"
    >
      <ArrowLeft size={16} /> Charge Points
    </Link>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-slate-200 mt-0.5">{value}</dd>
    </div>
  );
}
