import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Cell renderer. */
  render?: (row: T) => ReactNode;
  /** Value used for sorting (defaults to row[key]). */
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}

/** Sortable, paginated, sticky-header table for large datasets. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  pageSize = 25,
  initialSort,
  empty,
  onRowClick,
}: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    initialSort ?? null,
  );
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (r: T) =>
      col.sortValue ? col.sortValue(r) : ((r as Record<string, unknown>)[sort.key] as string | number);
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = val(a) ?? '';
      const vb = val(b) ?? '';
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clamped = Math.min(page, pages - 1);
  const slice = sorted.slice(clamped * pageSize, clamped * pageSize + pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' },
    );
  }

  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-ink-800">
            <tr className="text-xs text-slate-500 uppercase border-b border-ink-600/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`font-semibold px-4 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'} ${
                    c.sortable ? 'cursor-pointer select-none hover:text-slate-300' : ''
                  }`}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {c.header}
                    {c.sortable &&
                      (sort?.key === c.key ? (
                        sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      ) : (
                        <ChevronsUpDown size={12} className="text-slate-600" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-600/40">
            {slice.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`hover:bg-ink-700/40 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${c.className ?? ''}`}
                  >
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-ink-600/50 text-xs text-slate-400">
          <span>
            {clamped * pageSize + 1}–{Math.min((clamped + 1) * pageSize, sorted.length)} of{' '}
            {sorted.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, clamped - 1))}
              disabled={clamped === 0}
              className="px-2 py-1 rounded hover:bg-ink-600/50 disabled:opacity-30"
            >
              Prev
            </button>
            <span className="px-1">
              {clamped + 1} / {pages}
            </span>
            <button
              onClick={() => setPage(Math.min(pages - 1, clamped + 1))}
              disabled={clamped >= pages - 1}
              className="px-2 py-1 rounded hover:bg-ink-600/50 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
