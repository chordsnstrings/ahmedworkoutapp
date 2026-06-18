import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from './config';
import { exportUsers, importUsers } from './auth';
import { bus } from './events';
import { log } from './logger';
import { store } from './store';

interface Snapshot {
  store: ReturnType<typeof store.exportState>;
  users: ReturnType<typeof exportUsers>;
}

interface Backend {
  load(): Promise<Snapshot | null>;
  save(s: Snapshot): Promise<void>;
}

/** File-backed snapshot (local dev / single host with a volume). */
function fileBackend(): Backend {
  const file = resolve(process.env.DATA_DIR ?? './data', 'state.json');
  return {
    async load() {
      if (!existsSync(file)) return null;
      return JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
    },
    async save(s) {
      mkdirSync(dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(s));
      renameSync(tmp, file); // atomic replace
    },
  };
}

/** Postgres-backed snapshot (managed DB on DigitalOcean / production). */
async function postgresBackend(): Promise<Backend> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 4,
  });
  await pool.query(
    `CREATE TABLE IF NOT EXISTS platform_state (
       id int PRIMARY KEY,
       data jsonb NOT NULL,
       updated_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  log.info('Connected to PostgreSQL for state persistence');
  return {
    async load() {
      const r = await pool.query<{ data: Snapshot }>(
        'SELECT data FROM platform_state WHERE id = 1',
      );
      return r.rows[0]?.data ?? null;
    },
    async save(s) {
      await pool.query(
        `INSERT INTO platform_state (id, data, updated_at) VALUES (1, $1, now())
         ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
        [s],
      );
    },
  };
}

let backend: Backend = fileBackend();

async function writeState() {
  try {
    await backend.save({ store: store.exportState(), users: exportUsers() });
  } catch (e) {
    log.error('Failed to persist state:', (e as Error).message);
  }
}

let timer: NodeJS.Timeout | null = null;
function scheduleWrite() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void writeState();
  }, 2000);
}

/** Initialise persistence, restore any snapshot, and persist on every change. */
export async function startPersistence() {
  try {
    backend = config.databaseUrl ? await postgresBackend() : fileBackend();
  } catch (e) {
    log.error('Persistence backend init failed, falling back to file:', (e as Error).message);
    backend = fileBackend();
  }

  try {
    const snapshot = await backend.load();
    if (snapshot) {
      store.importState(snapshot.store);
      importUsers(snapshot.users);
      log.info('Restored persisted state');
    } else {
      log.info('No persisted state; starting from seeded demo data');
    }
  } catch (e) {
    log.error('Failed to load persisted state:', (e as Error).message);
  }

  // Event-driven saves cover live traffic; a periodic flush guarantees that
  // config-only changes (which don't emit bus events) are persisted too.
  bus.onEvent(scheduleWrite);
  setInterval(scheduleWrite, 20_000).unref();

  const flush = () => {
    if (timer) clearTimeout(timer);
    void writeState().finally(() => process.exit(0));
  };
  process.on('SIGINT', flush);
  process.on('SIGTERM', flush);
  log.info(
    `Persistence enabled (${config.databaseUrl ? 'postgres' : 'file'})`,
  );
}
