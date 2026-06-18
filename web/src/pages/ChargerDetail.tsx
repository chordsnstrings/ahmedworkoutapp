import { Fragment, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Download,
  FileDown,
  Gauge,
  ListTree,
  Lock,
  Play,
  Power,
  RotateCcw,
  Square,
  Zap,
} from 'lucide-react';
import { SessionChart } from '../components/SessionChart';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
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
  const { can } = useAuth();
  const readOnly = !can('operator');
  const { chargers, transactions, reservations, tenants, branding } = useLive();
  const charger = chargers.find((c) => c.id === id);

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [idTag, setIdTag] = useState('RFID-0001');
  const [connectorId, setConnectorId] = useState(1);
  const [limitA, setLimitA] = useState(16);
  const [resMinutes, setResMinutes] = useState(30);
  const [cfgKey, setCfgKey] = useState('HeartbeatInterval');
  const [cfgValue, setCfgValue] = useState('60');
  const [fwLocation, setFwLocation] = useState('https://firmware.example.com/v2.tar.gz');
  const [openTx, setOpenTx] = useState<string | null>(null);

  const activeReservations = reservations.filter(
    (r) => r.chargerId === id && r.status === 'Active',
  );

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
              <Field
                label="Uptime"
                value={
                  charger.uptimePct != null ? `${charger.uptimePct}%` : '—'
                }
              />
              <Field label="Faults 24h" value={String(charger.faults24h ?? 0)} />
              <Field
                label="Plug & Charge"
                value={
                  <button
                    disabled={readOnly}
                    onClick={() =>
                      run('Plug & Charge', () =>
                        api.post(`/chargers/${id}/plug-and-charge`, {
                          enabled: !charger.plugAndCharge,
                        }),
                      )
                    }
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      charger.plugAndCharge
                        ? 'bg-accent/15 text-accent'
                        : 'bg-ink-600/60 text-slate-400'
                    } disabled:opacity-60`}
                  >
                    {charger.plugAndCharge ? 'Enabled' : 'Disabled'}
                  </button>
                }
              />
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
                    disabled={readOnly}
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
                      <th className="font-semibold px-1 py-2 w-4"></th>
                      <th className="font-semibold px-1 py-2">Started</th>
                      <th className="font-semibold px-1 py-2">Duration</th>
                      <th className="font-semibold px-1 py-2">Energy</th>
                      <th className="font-semibold px-1 py-2">SoC</th>
                      <th className="font-semibold px-1 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-600/40">
                    {sessions.slice(0, 12).map((tx) => (
                      <Fragment key={tx.id}>
                        <tr
                          onClick={() => setOpenTx(openTx === tx.id ? null : tx.id)}
                          className="cursor-pointer hover:bg-ink-700/40"
                        >
                          <td className="px-1 py-2 text-slate-500">
                            <ChevronRight
                              size={14}
                              className={`transition-transform ${openTx === tx.id ? 'rotate-90' : ''}`}
                            />
                          </td>
                          <td className="px-1 py-2 text-slate-300 whitespace-nowrap">
                            {dateTime(tx.startedAt)}
                            {tx.signed && (
                              <Lock size={11} className="inline ml-1 text-emerald-400" />
                            )}
                          </td>
                          <td className="px-1 py-2 text-slate-400">
                            {duration(tx.startedAt, tx.endedAt)}
                          </td>
                          <td className="px-1 py-2 text-slate-300">{kwh(tx.energyWh)}</td>
                          <td className="px-1 py-2 text-slate-400">
                            {tx.soc != null ? `${tx.soc}%` : '—'}
                          </td>
                          <td className="px-1 py-2 text-right">
                            {tx.state === 'Active' ? (
                              <span className="text-accent">live</span>
                            ) : (
                              money(tx.cost, tx.currency ?? branding.currency)
                            )}
                          </td>
                        </tr>
                        {openTx === tx.id && (
                          <tr>
                            <td colSpan={6} className="px-1 pb-3">
                              <SessionChart samples={tx.samples} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: command panel */}
        <div className="space-y-4">
          {readOnly && (
            <div className="card p-4 text-sm text-slate-400">
              You have read-only access. Remote control requires an operator role.
            </div>
          )}
          <div className={`card p-4 sm:p-5 ${readOnly ? 'hidden' : ''}`}>
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

          <div className={`card p-4 sm:p-5 ${readOnly ? 'hidden' : ''}`}>
            <h2 className="font-semibold text-white mb-3">Reservations</h2>
            <div className="flex items-end gap-2">
              <label className="block flex-1">
                <span className="label">Hold for (min)</span>
                <input
                  type="number"
                  min={5}
                  value={resMinutes}
                  onChange={(e) => setResMinutes(Number(e.target.value))}
                  className="input mt-1"
                />
              </label>
              <button
                disabled={!online || busy != null}
                onClick={() =>
                  run('Reserve', () =>
                    api.post(`/chargers/${id}/reserve`, {
                      connectorId,
                      idTag,
                      minutes: resMinutes,
                    }),
                  )
                }
                className="btn-ghost"
              >
                <CalendarClock size={16} /> Reserve C{connectorId}
              </button>
            </div>

            {activeReservations.length > 0 && (
              <ul className="mt-3 space-y-2">
                {activeReservations.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-ink-600/60 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="text-slate-200">
                        C{r.connectorId} · {r.idTag}
                      </div>
                      <div className="text-xs text-slate-500">
                        until {new Date(r.expiresAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        run('Cancel reservation', () =>
                          api.post(`/reservations/${r.id}/cancel`),
                        )
                      }
                      className="btn-ghost py-1 px-2 text-xs"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`card p-4 sm:p-5 ${readOnly ? 'hidden' : ''}`}>
            <h2 className="font-semibold text-white mb-3">
              Configuration &amp; firmware
            </h2>

            <div className="flex items-center gap-2">
              <button
                disabled={!online || busy != null}
                onClick={() =>
                  run('Read config', () => api.post(`/chargers/${id}/config`))
                }
                className="btn-ghost"
              >
                <ListTree size={16} /> Read config
              </button>
            </div>

            {charger.config && charger.config.length > 0 && (
              <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-ink-600/60 text-xs">
                <table className="w-full">
                  <tbody className="divide-y divide-ink-600/40">
                    {charger.config.map((k) => (
                      <tr key={k.key}>
                        <td className="px-2 py-1.5 text-slate-400 font-mono">{k.key}</td>
                        <td className="px-2 py-1.5 text-slate-200 text-right font-mono">
                          {k.value ?? '—'}
                          {k.readonly && (
                            <span className="ml-1 text-[10px] text-slate-600">ro</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <input
                value={cfgKey}
                onChange={(e) => setCfgKey(e.target.value)}
                className="input"
                placeholder="key"
              />
              <input
                value={cfgValue}
                onChange={(e) => setCfgValue(e.target.value)}
                className="input"
                placeholder="value"
              />
            </div>
            <button
              disabled={!online || busy != null}
              onClick={() =>
                run('Change config', () =>
                  api.post(`/chargers/${id}/config/set`, { key: cfgKey, value: cfgValue }),
                )
              }
              className="btn-ghost w-full justify-center mt-2"
            >
              Set configuration key
            </button>

            <div className="border-t border-ink-600/50 mt-3 pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="label">Firmware</span>
                {charger.firmwareStatus && (
                  <span className="text-xs text-accent">{charger.firmwareStatus}</span>
                )}
              </div>
              <input
                value={fwLocation}
                onChange={(e) => setFwLocation(e.target.value)}
                className="input"
                placeholder="firmware URL"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={!online || busy != null}
                  onClick={() =>
                    run('Update firmware', () =>
                      api.post(`/chargers/${id}/firmware`, { location: fwLocation }),
                    )
                  }
                  className="btn-ghost justify-center"
                >
                  <Download size={16} /> Update FW
                </button>
                <button
                  disabled={!online || busy != null}
                  onClick={() =>
                    run('Get diagnostics', () =>
                      api.post(`/chargers/${id}/diagnostics`, {
                        location: 'https://diag.example.com/upload',
                      }),
                    )
                  }
                  className="btn-ghost justify-center"
                >
                  <FileDown size={16} /> Diagnostics
                </button>
              </div>
              {charger.diagnosticsStatus && (
                <div className="text-xs text-slate-500">
                  Diagnostics: {charger.diagnosticsStatus}
                </div>
              )}
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
