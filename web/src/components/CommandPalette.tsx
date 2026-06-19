import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Building2,
  CornerDownLeft,
  PlugZap,
  Search,
  Wallet,
} from 'lucide-react';
import { ALL_TENANTS, useLive } from '../store/live';
import { useAuth } from '../store/auth';

interface Item {
  id: string;
  label: string;
  sub?: string;
  group: string;
  icon: typeof PlugZap;
  run: () => void;
}

const PAGES: { label: string; path: string; role?: 'admin' }[] = [
  { label: 'Overview', path: '/' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Ops Assistant', path: '/assistant' },
  { label: 'Charge Points', path: '/chargers' },
  { label: 'Station Map', path: '/map' },
  { label: 'Sessions', path: '/transactions' },
  { label: 'Load Management', path: '/load' },
  { label: 'Energy & DR', path: '/energy' },
  { label: 'Alerts', path: '/alerts' },
  { label: 'Maintenance', path: '/maintenance' },
  { label: 'Access / RFID', path: '/access' },
  { label: 'Drivers & Wallets', path: '/drivers' },
  { label: 'Plug & Charge', path: '/plug-and-charge' },
  { label: 'Tariffs', path: '/tariffs' },
  { label: 'Payments', path: '/payments' },
  { label: 'Roaming (OCPI)', path: '/roaming' },
  { label: 'Reports', path: '/reports' },
  { label: 'Live OCPP Log', path: '/logs' },
  { label: 'Observability', path: '/observability' },
  { label: 'Settings', path: '/settings' },
  { label: 'Audit Log', path: '/audit', role: 'admin' },
  { label: 'Notifications', path: '/notifications', role: 'admin' },
  { label: 'Users & Roles', path: '/users', role: 'admin' },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { chargers, tenants, setTenantId } = useLive();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => {
      navigate(path);
      onClose();
    };
    const out: Item[] = [];
    for (const p of PAGES)
      if (!p.role || can(p.role))
        out.push({ id: `pg:${p.path}`, label: p.label, group: 'Pages', icon: Search, run: go(p.path) });
    for (const c of chargers)
      out.push({
        id: `cp:${c.id}`,
        label: c.id,
        sub: `${c.vendor ?? ''} ${c.model ?? ''}`.trim() || c.state,
        group: 'Charge points',
        icon: PlugZap,
        run: go(`/chargers/${c.id}`),
      });
    out.push({ id: 'op:all', label: 'All operators', group: 'Operators', icon: Building2, run: () => { setTenantId(ALL_TENANTS); onClose(); } });
    for (const t of tenants)
      out.push({
        id: `op:${t.id}`,
        label: t.name,
        sub: 'Switch operator',
        group: 'Operators',
        icon: Building2,
        run: () => { setTenantId(t.id); onClose(); },
      });
    out.push({ id: 'q:drivers', label: 'Drivers & Wallets', group: 'Quick', icon: Wallet, run: go('/drivers') });
    out.push({ id: 'q:pnc', label: 'Plug & Charge contracts', group: 'Quick', icon: BadgeCheck, run: go('/plug-and-charge') });
    return out;
  }, [chargers, tenants, can, navigate, onClose, setTenantId]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const list = needle
      ? items.filter((i) => `${i.label} ${i.sub ?? ''} ${i.group}`.toLowerCase().includes(needle))
      : items;
    return list.slice(0, 40);
  }, [items, q]);

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  const groups = [...new Set(filtered.map((i) => i.group))];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 border-b border-ink-600/60">
          <Search size={16} className="text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); filtered[sel]?.run(); }
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Search pages, chargers, operators…"
            className="flex-1 bg-transparent py-3.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <kbd className="text-[10px] text-slate-500 border border-ink-600 rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No matches</div>
          ) : (
            groups.map((g) => (
              <div key={g}>
                <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-600">{g}</div>
                {filtered
                  .map((i, idx) => [i, idx] as const)
                  .filter(([i]) => i.group === g)
                  .map(([i, idx]) => {
                    const Icon = i.icon;
                    return (
                      <button
                        key={i.id}
                        onMouseEnter={() => setSel(idx)}
                        onClick={() => i.run()}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm ${
                          sel === idx ? 'bg-accent/15 text-accent' : 'text-slate-200 hover:bg-ink-700/40'
                        }`}
                      >
                        <Icon size={15} className={sel === idx ? 'text-accent' : 'text-slate-500'} />
                        <span className="flex-1 truncate">{i.label}</span>
                        {i.sub && <span className="text-xs text-slate-500 truncate max-w-[40%]">{i.sub}</span>}
                        {sel === idx && <CornerDownLeft size={13} className="text-accent" />}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
