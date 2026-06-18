import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AlertDTO,
  AnalyticsDTO,
  BrandingDTO,
  ChargerDTO,
  DemandResponseEventDTO,
  LoadGroupDTO,
  LogEntryDTO,
  ReservationDTO,
  ServerEvent,
  TenantDTO,
  TransactionDTO,
} from '@ocpp/shared';
import { api, eventsUrl } from '../lib/api';

const ALL_TENANTS = '__all__';

interface LiveData {
  connected: boolean;
  chargers: ChargerDTO[];
  transactions: TransactionDTO[];
  logs: LogEntryDTO[];
  alerts: AlertDTO[];
  loadGroups: LoadGroupDTO[];
  reservations: ReservationDTO[];
  demandResponse: DemandResponseEventDTO[];
  analytics: AnalyticsDTO | null;
  branding: BrandingDTO;
  setBranding: (b: BrandingDTO) => void;
  tenants: TenantDTO[];
  /** Selected operator id, or ALL_TENANTS for the platform-wide view. */
  tenantId: string;
  setTenantId: (id: string) => void;
  /** True when no specific operator is selected. */
  allTenants: boolean;
}

export { ALL_TENANTS };

const Ctx = createContext<LiveData | null>(null);

const MAX_LOGS = 400;

export function LiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [chargers, setChargers] = useState<ChargerDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [logs, setLogs] = useState<LogEntryDTO[]>([]);
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [loadGroups, setLoadGroups] = useState<LoadGroupDTO[]>([]);
  const [reservations, setReservations] = useState<ReservationDTO[]>([]);
  const [demandResponse, setDemandResponse] = useState<DemandResponseEventDTO[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsDTO | null>(null);
  const [branding, setBranding] = useState<BrandingDTO>({
    platformName: 'OCPP CSMS',
    accentColor: '#22d3ee',
    currency: 'USD',
  });
  const [tenants, setTenants] = useState<TenantDTO[]>([]);
  const [tenantId, setTenantIdState] = useState<string>(
    () => localStorage.getItem('tenantId') ?? ALL_TENANTS,
  );
  const esRef = useRef<EventSource | null>(null);

  const setTenantId = (id: string) => {
    setTenantIdState(id);
    localStorage.setItem('tenantId', id);
  };

  // Initial snapshot.
  useEffect(() => {
    void (async () => {
      try {
        const [c, t, l, a, b, tn, al, lg] = await Promise.all([
          api.get<ChargerDTO[]>('/chargers'),
          api.get<TransactionDTO[]>('/transactions'),
          api.get<LogEntryDTO[]>('/logs'),
          api.get<AnalyticsDTO>('/analytics'),
          api.get<BrandingDTO>('/branding'),
          api.get<TenantDTO[]>('/tenants'),
          api.get<AlertDTO[]>('/alerts'),
          api.get<LoadGroupDTO[]>('/load-groups'),
        ]);
        setChargers(c);
        setTransactions(t);
        setLogs(l);
        setAnalytics(a);
        setBranding(b);
        setTenants(tn);
        setAlerts(al);
        setLoadGroups(lg);
        setReservations(await api.get<ReservationDTO[]>('/reservations'));
        setDemandResponse(
          await api.get<DemandResponseEventDTO[]>('/demand-response'),
        );
      } catch {
        /* server may not be up yet; SSE will backfill */
      }
    })();
  }, []);

  // Live stream.
  useEffect(() => {
    const es = new EventSource(eventsUrl());
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg) => {
      const e: ServerEvent = JSON.parse(msg.data);
      switch (e.type) {
        case 'charger':
          setChargers((prev) => {
            const i = prev.findIndex((c) => c.id === e.charger.id);
            if (i < 0) return [...prev, e.charger];
            const next = [...prev];
            next[i] = e.charger;
            return next;
          });
          break;
        case 'charger:removed':
          setChargers((prev) => prev.filter((c) => c.id !== e.chargerId));
          break;
        case 'transaction':
          setTransactions((prev) => {
            const i = prev.findIndex((t) => t.id === e.transaction.id);
            if (i < 0) return [e.transaction, ...prev];
            const next = [...prev];
            next[i] = e.transaction;
            return next;
          });
          break;
        case 'log':
          setLogs((prev) => [e.entry, ...prev].slice(0, MAX_LOGS));
          break;
        case 'analytics':
          setAnalytics(e.analytics);
          break;
        case 'alert':
          setAlerts((prev) => {
            const i = prev.findIndex((a) => a.id === e.alert.id);
            if (i < 0) return [e.alert, ...prev].slice(0, 200);
            const next = [...prev];
            next[i] = e.alert;
            return next;
          });
          break;
        case 'loadgroup':
          setLoadGroups((prev) => {
            const i = prev.findIndex((g) => g.id === e.group.id);
            if (i < 0) return [...prev, e.group];
            const next = [...prev];
            next[i] = e.group;
            return next;
          });
          break;
        case 'reservation':
          setReservations((prev) => {
            const i = prev.findIndex((r) => r.id === e.reservation.id);
            if (i < 0) return [e.reservation, ...prev];
            const next = [...prev];
            next[i] = e.reservation;
            return next;
          });
          break;
        case 'demandresponse':
          setDemandResponse((prev) => {
            const i = prev.findIndex((d) => d.id === e.event.id);
            if (i < 0) return [e.event, ...prev];
            const next = [...prev];
            next[i] = e.event;
            return next;
          });
          break;
      }
    };
    return () => es.close();
  }, []);

  // Apply accent colour as a CSS variable for branding.
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', branding.accentColor);
  }, [branding.accentColor]);

  const value = useMemo<LiveData>(
    () => ({
      connected,
      chargers,
      transactions,
      logs,
      alerts,
      loadGroups,
      reservations,
      demandResponse,
      analytics,
      branding,
      setBranding,
      tenants,
      tenantId,
      setTenantId,
      allTenants: tenantId === ALL_TENANTS,
    }),
    [connected, chargers, transactions, logs, alerts, loadGroups, reservations, demandResponse, analytics, branding, tenants, tenantId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive(): LiveData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLive must be used within LiveProvider');
  return ctx;
}

/** Live data filtered to the currently selected operator (tenant). */
export function useScoped() {
  const { chargers, transactions, logs, alerts, loadGroups, tenantId, allTenants, branding } =
    useLive();
  return useMemo(() => {
    const chargerTenant = new Map(chargers.map((c) => [c.id, c.tenantId]));
    const inScope = (chargerId: string) =>
      allTenants || chargerTenant.get(chargerId) === tenantId;

    const scopedChargers = allTenants
      ? chargers
      : chargers.filter((c) => c.tenantId === tenantId);

    return {
      chargers: scopedChargers,
      transactions: transactions.filter((t) => inScope(t.chargerId)),
      logs: logs.filter((l) => inScope(l.chargerId)),
      alerts: alerts.filter((a) => inScope(a.chargerId)),
      loadGroups: allTenants
        ? loadGroups
        : loadGroups.filter((g) => g.tenantId === tenantId),
      currency: branding.currency,
    };
  }, [chargers, transactions, logs, alerts, loadGroups, tenantId, allTenants, branding.currency]);
}
