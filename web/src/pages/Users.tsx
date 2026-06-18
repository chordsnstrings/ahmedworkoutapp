import { useEffect, useState } from 'react';
import { Plus, Trash2, UserCog } from 'lucide-react';
import type { UserDTO, UserRole } from '@ocpp/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { dateTime } from '../lib/format';
import { EmptyState, PageHeader } from '../components/ui';

const ROLE_STYLE: Record<UserRole, string> = {
  admin: 'bg-violet-500/15 text-violet-300',
  operator: 'bg-accent/15 text-accent',
  viewer: 'bg-slate-500/15 text-slate-400',
};

const blank = { name: '', email: '', role: 'operator' as UserRole, password: '' };

export function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [form, setForm] = useState({ ...blank });
  const [error, setError] = useState('');

  async function load() {
    setUsers(await api.get<UserDTO[]>('/users'));
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || !form.password) return;
    try {
      await api.post('/users', form);
      setForm({ ...blank });
      setError('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(u: UserDTO) {
    await api.del(`/users/${u.id}`);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle="Operator console access (RBAC)"
      />

      <form onSubmit={add} className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <label className="block">
          <span className="label">Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input mt-1"
          />
        </label>
        <label className="block">
          <span className="label">Role</span>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            className="input mt-1"
          >
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input mt-1"
          />
        </label>
        <button type="submit" className="btn-primary justify-center">
          <Plus size={16} /> Add user
        </button>
      </form>
      {error && <p className="text-sm text-red-300 mb-3">{error}</p>}

      {users.length === 0 ? (
        <EmptyState title="No users" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-ink-600/60">
                <th className="font-semibold px-4 py-3">Name</th>
                <th className="font-semibold px-4 py-3">Email</th>
                <th className="font-semibold px-4 py-3">Role</th>
                <th className="font-semibold px-4 py-3">Added</th>
                <th className="font-semibold px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/40">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-ink-700/40">
                  <td className="px-4 py-3 text-slate-100 font-medium flex items-center gap-2">
                    <UserCog size={15} className="text-slate-500" />
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_STYLE[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{dateTime(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.id && (
                      <button onClick={() => remove(u)} className="btn-danger py-1 px-2">
                        <Trash2 size={14} />
                      </button>
                    )}
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
