export const config = {
  /** HTTP + OCPP WebSocket port. */
  port: Number(process.env.PORT ?? 3000),
  /** Seconds a charge point should wait between Heartbeats. */
  heartbeatInterval: Number(process.env.OCPP_HEARTBEAT_INTERVAL ?? 60),
  /** How long without any message before a charger is marked Offline (ms). */
  offlineAfterMs: Number(process.env.OCPP_OFFLINE_AFTER_MS ?? 90_000),
  /** Max OCPP messages retained in the in-memory live log. */
  maxLogEntries: Number(process.env.OCPP_MAX_LOG ?? 500),
  /**
   * Optional API key required on dashboard REST calls (header `x-api-key`).
   * Empty means open access — fine for local development.
   */
  apiKey: process.env.API_KEY ?? '',
  defaultCurrency: process.env.CURRENCY ?? 'USD',
  /** Secret used to sign dashboard auth tokens. Set in production. */
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  /** Optional Stripe secret key. When set, real PaymentIntents are created. */
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
};
