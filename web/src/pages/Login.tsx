import { useState } from 'react';
import { LogIn, Zap } from 'lucide-react';
import { useAuth } from '../store/auth';

const DEMO = [
  { role: 'Admin', email: 'admin@local', password: 'admin123' },
  { role: 'Operator', email: 'ops@local', password: 'ops12345' },
  { role: 'Viewer', email: 'view@local', password: 'view1234' },
];

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="grid place-items-center w-11 h-11 rounded-xl bg-accent/15 text-accent">
            <Zap size={24} />
          </div>
          <div>
            <div className="font-bold text-white text-lg leading-tight">OCPP CSMS</div>
            <div className="text-xs text-slate-500">Operator console</div>
          </div>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
            <LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <div className="text-xs text-slate-500 mb-2">Demo accounts — click to fill</div>
          <div className="flex gap-2 justify-center">
            {DEMO.map((d) => (
              <button
                key={d.email}
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="btn-ghost py-1 px-2 text-xs"
              >
                {d.role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
