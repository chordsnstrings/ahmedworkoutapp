import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  BadgeCheck,
  BatteryCharging,
  Bell,
  CircleDollarSign,
  CreditCard,
  Gauge,
  Globe,
  Leaf,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  FileBarChart,
  PlugZap,
  ScrollText,
  Settings as SettingsIcon,
  Sparkles,
  Users as UsersIcon,
  X,
  Zap,
} from 'lucide-react';
import type { UserRole } from '@ocpp/shared';
import { ALL_TENANTS, useLive, useScoped } from '../store/live';
import { useAuth } from '../store/auth';

const NAV: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  role?: UserRole;
}[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/assistant', label: 'Ops Assistant', icon: Sparkles },
  { to: '/chargers', label: 'Charge Points', icon: PlugZap },
  { to: '/transactions', label: 'Sessions', icon: BatteryCharging },
  { to: '/load', label: 'Load Management', icon: Gauge },
  { to: '/energy', label: 'Energy & DR', icon: Leaf },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/access', label: 'Access / RFID', icon: KeyRound },
  { to: '/plug-and-charge', label: 'Plug & Charge', icon: BadgeCheck },
  { to: '/tariffs', label: 'Tariffs', icon: CircleDollarSign },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/roaming', label: 'Roaming (OCPI)', icon: Globe },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/logs', label: 'Live OCPP Log', icon: Activity },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, role: 'admin' },
  { to: '/users', label: 'Users & Roles', icon: UsersIcon, role: 'admin' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function OperatorSwitcher() {
  const { tenants, tenantId, setTenantId } = useLive();
  return (
    <div className="relative">
      <select
        value={tenantId}
        onChange={(e) => setTenantId(e.target.value)}
        className="appearance-none bg-ink-700 border border-ink-600 rounded-lg pl-3 pr-9 py-2
          text-sm font-medium text-slate-100 outline-none focus:border-accent cursor-pointer
          max-w-[200px] truncate"
        title="Switch operator (tenant)"
      >
        <option value={ALL_TENANTS}>All operators</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { branding } = useLive();
  const { can } = useAuth();
  const items = NAV.filter((n) => !n.role || can(n.role));
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-ink-600/60">
        <div className="grid place-items-center w-9 h-9 rounded-lg bg-accent/15 text-accent">
          <Zap size={20} />
        </div>
        <div className="leading-tight">
          <div className="font-bold text-white tracking-tight">
            {branding.platformName}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">
            OCPP 1.6 · 2.0.1
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-ink-600/50'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 text-[11px] text-slate-600 border-t border-ink-600/60">
        Central System Management Platform
      </div>
    </div>
  );
}

function AlertBell() {
  const { alerts } = useScoped();
  const open = alerts.filter((a) => !a.acknowledged).length;
  const critical = alerts.some((a) => !a.acknowledged && a.severity === 'critical');
  return (
    <NavLink
      to="/alerts"
      className="relative text-slate-300 hover:text-white"
      aria-label="Alerts"
    >
      <Bell size={20} />
      {open > 0 && (
        <span
          className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 grid place-items-center
            rounded-full text-[10px] font-bold text-ink-900 ${
              critical ? 'bg-red-400' : 'bg-amber-400'
            }`}
        >
          {open > 9 ? '9+' : open}
        </span>
      )}
    </NavLink>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg hover:bg-ink-700 px-2 py-1.5"
      >
        <span className="grid place-items-center w-7 h-7 rounded-full bg-accent/20 text-accent text-xs font-bold">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:block text-left leading-tight">
          <span className="block text-xs font-medium text-slate-200">{user.name}</span>
          <span className="block text-[10px] text-slate-500 capitalize">{user.role}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-48 card p-1 shadow-xl">
            <div className="px-3 py-2 border-b border-ink-600/60">
              <div className="text-sm text-slate-200">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-ink-600/50"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { connected } = useLive();
  const location = useLocation();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block border-r border-ink-600/60 bg-ink-800 sticky top-0 h-screen">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-ink-800 border-r border-ink-600 shadow-2xl">
            <button
              className="absolute right-3 top-4 text-slate-400 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 sm:px-6
          border-b border-ink-600/60 bg-ink-900/80 backdrop-blur">
          <button
            className="lg:hidden text-slate-300 hover:text-white"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <div
            className={`hidden sm:flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-full ${
              connected
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-amber-500/10 text-amber-300'
            }`}
            title="Realtime event stream"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {connected ? 'Live' : 'Reconnecting'}
          </div>
          <AlertBell />
          <OperatorSwitcher />
          <UserMenu />
        </header>

        <main
          key={location.pathname}
          className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
