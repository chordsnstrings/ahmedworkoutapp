export function kwh(wh: number | undefined): string {
  return `${((wh ?? 0) / 1000).toFixed(2)} kWh`;
}

export function money(amount: number | undefined, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount ?? 0);
  } catch {
    return `${(amount ?? 0).toFixed(2)} ${currency}`;
  }
}

export function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - Date.parse(iso);
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function dateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function duration(startIso?: string, endIso?: string): string {
  if (!startIso) return '—';
  const end = endIso ? Date.parse(endIso) : Date.now();
  const sec = Math.max(0, Math.round((end - Date.parse(startIso)) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
