import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { exportUsers, importUsers } from './auth';
import { bus } from './events';
import { log } from './logger';
import { store } from './store';

const DATA_FILE = resolve(process.env.DATA_DIR ?? './data', 'state.json');

/** Load a persisted snapshot, if one exists, replacing the seeded demo data. */
export function loadState() {
  if (!existsSync(DATA_FILE)) {
    log.info('No persisted state; starting from seeded demo data');
    return;
  }
  try {
    const snapshot = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    store.importState(snapshot.store);
    importUsers(snapshot.users);
    log.info(`Restored persisted state from ${DATA_FILE}`);
  } catch (e) {
    log.error('Failed to load persisted state:', (e as Error).message);
  }
}

function writeState() {
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    writeFileSync(
      tmp,
      JSON.stringify({ store: store.exportState(), users: exportUsers() }),
    );
    renameSync(tmp, DATA_FILE); // atomic replace
  } catch (e) {
    log.error('Failed to persist state:', (e as Error).message);
  }
}

let timer: NodeJS.Timeout | null = null;
function scheduleWrite() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    writeState();
  }, 2000);
}

/** Persist on every domain change (debounced) and on shutdown. */
export function startPersistence() {
  loadState();
  bus.onEvent(scheduleWrite);
  const flush = () => {
    if (timer) clearTimeout(timer);
    writeState();
  };
  process.on('SIGINT', () => {
    flush();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    flush();
    process.exit(0);
  });
  log.info(`Persistence enabled → ${DATA_FILE}`);
}
