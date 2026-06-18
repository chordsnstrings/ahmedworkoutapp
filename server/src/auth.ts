import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthResponse, UserDTO, UserRole } from '@ocpp/shared';
import { config } from './config';

const TOKEN_TTL_SEC = 12 * 60 * 60;

// ---------------------------------------------------------------- user store
interface UserRecord extends UserDTO {
  passwordHash: string;
}
const users = new Map<string, UserRecord>();
const toDTO = ({ passwordHash: _ph, ...u }: UserRecord): UserDTO => u;

function seedUsers() {
  const seed: Array<Omit<UserRecord, 'passwordHash' | 'id' | 'createdAt'> & { password: string }> = [
    { email: 'admin@local', name: 'Platform Admin', role: 'admin', password: 'admin123' },
    { email: 'ops@local', name: 'Network Operator', role: 'operator', password: 'ops12345' },
    { email: 'view@local', name: 'Read Only', role: 'viewer', password: 'view1234' },
  ];
  for (const s of seed) {
    const id = randomUUID();
    users.set(id, {
      id,
      email: s.email,
      name: s.name,
      role: s.role,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(s.password),
    });
  }
}

export function getUser(id: string): UserDTO | undefined {
  const u = users.get(id);
  return u ? toDTO(u) : undefined;
}
export function listUsers(): UserDTO[] {
  return [...users.values()].map(toDTO);
}
export function upsertUser(input: {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  password?: string;
}): UserDTO {
  const existing = input.id ? users.get(input.id) : undefined;
  const id = existing?.id ?? randomUUID();
  const record: UserRecord = {
    id,
    email: input.email,
    name: input.name,
    role: input.role,
    tenantId: input.tenantId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    passwordHash: input.password
      ? hashPassword(input.password)
      : (existing?.passwordHash ?? hashPassword(randomBytes(8).toString('hex'))),
  };
  users.set(id, record);
  return toDTO(record);
}
export function deleteUser(id: string): boolean {
  return users.delete(id);
}

export function login(email: string, password: string): AuthResponse | null {
  const record = [...users.values()].find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (!record || !verifyPassword(password, record.passwordHash)) return null;
  const user = toDTO(record);
  return { token: issueToken(user), user };
}

// ---------------------------------------------------------------- passwords
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ------------------------------------------------------------------- tokens
const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64url');

function sign(data: string): string {
  return createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
}

export function issueToken(user: UserDTO): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
    }),
  );
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

interface TokenClaims {
  sub: string;
  role: UserRole;
  email: string;
  exp: number;
}

export function verifyToken(token: string): TokenClaims | null {
  const [header, payload, sig] = token.split('.');
  if (!header || !payload || !sig) return null;
  if (sign(`${header}.${payload}`) !== sig) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as TokenClaims;
    if (claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------- middleware
declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDTO;
  }
}

/** Routes that do not require a logged-in user. */
const PUBLIC_PATHS = [/^\/auth\/login$/, /^\/health$/, /^\/public\//];

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_PATHS.some((re) => re.test(req.path))) return next();

  const headerToken = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const token = headerToken || (req.query.token as string | undefined);
  const claims = token ? verifyToken(token) : null;
  if (!claims) return res.status(401).json({ error: 'Authentication required' });

  const user = getUser(claims.sub);
  if (!user) return res.status(401).json({ error: 'Unknown user' });
  req.user = user;
  next();
}

const RANK: Record<UserRole, number> = { viewer: 0, operator: 1, admin: 2 };

/** Guard requiring at least the given role. */
export function requireRole(min: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || RANK[req.user.role] < RANK[min])
      return res.status(403).json({ error: `Requires ${min} role` });
    next();
  };
}

seedUsers();
