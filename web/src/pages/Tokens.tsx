import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TokenDTO, TokenStatus } from '@ocpp/shared';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { EmptyState, PageHeader } from '../components/ui';

const STATUS_STYLE: Record<TokenStatus, string> = {
  Accepted: 'bg-emerald-500/15 text-emerald-300',
  Blocked: 'bg-red-500/15 text-red-300',
  Expired: 'bg-amber-500/15 text-amber-300',
};

export function Tokens() {
  const [tokens, setTokens] = useState<TokenDTO[]>([]);
  const [idTag, setIdTag] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setTokens(await api.get<TokenDTO[]>('/tokens'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!idTag.trim()) return;
    try {
      await api.post('/tokens', {
        idTag: idTag.trim(),
        label: label.trim() || undefined,
        status: 'Accepted',
      });
      setIdTag('');
      setLabel('');
      setError('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function setStatus(t: TokenDTO, status: TokenStatus) {
    await api.put(`/tokens/${encodeURIComponent(t.idTag)}`, { ...t, status });
    await load();
  }

  async function remove(t: TokenDTO) {
    await api.del(`/tokens/${encodeURIComponent(t.idTag)}`);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Access / RFID"
        subtitle="Authorization tokens that may start charging sessions"
      />

      <form onSubmit={add} className="card p-4 mb-4 flex flex-col sm:flex-row gap-2">
        <input
          value={idTag}
          onChange={(e) => setIdTag(e.target.value)}
          placeholder="ID tag (e.g. RFID-1234)"
          className="input sm:max-w-xs"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="input sm:max-w-xs"
        />
        <button type="submit" className="btn-primary justify-center">
          <Plus size={16} /> Add token
        </button>
      </form>
      {error && <p className="text-sm text-red-300 mb-3">{error}</p>}

      {tokens.length === 0 ? (
        <EmptyState title="No tokens" hint="Add an RFID tag to authorize charging." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-ink-600/60">
                <th className="font-semibold px-4 py-3">ID Tag</th>
                <th className="font-semibold px-4 py-3">Label</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="font-semibold px-4 py-3">Added</th>
                <th className="font-semibold px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/40">
              {tokens.map((t) => (
                <tr key={t.idTag} className="hover:bg-ink-700/40">
                  <td className="px-4 py-3 font-mono text-slate-100">{t.idTag}</td>
                  <td className="px-4 py-3 text-slate-400">{t.label ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{dateTime(t.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() =>
                          setStatus(t, t.status === 'Blocked' ? 'Accepted' : 'Blocked')
                        }
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        {t.status === 'Blocked' ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        onClick={() => remove(t)}
                        className="btn-danger py-1 px-2"
                        aria-label="Delete token"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
