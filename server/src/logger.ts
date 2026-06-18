/* Minimal leveled logger so the OCPP wire traffic is easy to follow in the console. */
const ts = () => new Date().toISOString();

export const log = {
  info: (...a: unknown[]) => console.log(`\x1b[36m[${ts()}]\x1b[0m`, ...a),
  warn: (...a: unknown[]) => console.warn(`\x1b[33m[${ts()}]\x1b[0m`, ...a),
  error: (...a: unknown[]) => console.error(`\x1b[31m[${ts()}]\x1b[0m`, ...a),
  ocpp: (dir: 'in' | 'out', cpId: string, ...a: unknown[]) =>
    console.log(
      `\x1b[35m[${ts()}]\x1b[0m ${dir === 'in' ? '←' : '→'} ${cpId}`,
      ...a,
    ),
};
