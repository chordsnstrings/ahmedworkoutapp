import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, UserDTO, UserRole } from '@ocpp/shared';
import { api, setAuthToken, setUnauthorizedHandler } from '../lib/api';

interface AuthState {
  user: UserDTO | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** True when the user's role meets or exceeds `min`. */
  can: (min: UserRole) => boolean;
}

const RANK: Record<UserRole, number> = { viewer: 0, operator: 1, admin: 2 };
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as UserDTO) : null;
  });
  const [ready, setReady] = useState(false);

  const logout = () => {
    setAuthToken(null);
    localStorage.removeItem('user');
    setUser(null);
  };

  useEffect(() => {
    setUnauthorizedHandler(logout);
    // Validate any persisted token on boot.
    void (async () => {
      if (localStorage.getItem('token')) {
        try {
          setUser(await api.get<UserDTO>('/auth/me'));
        } catch {
          logout();
        }
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        const res = await api.post<AuthResponse>('/auth/login', { email, password });
        setAuthToken(res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        setUser(res.user);
      },
      logout,
      can: (min) => !!user && RANK[user.role] >= RANK[min],
    }),
    [user, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
