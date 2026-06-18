# Deployment & Connection Guide

This guide takes the OCPP CSMS from this repo to a running, **internet-reachable**
deployment on DigitalOcean backed by **PostgreSQL**, and then walks through
**connecting real charge points** so you start seeing live data.

---

## 1. How it's packaged

- **One service, one container.** The Node/TypeScript server serves the REST API,
  the OCPP **WebSocket** endpoint, the OCPI endpoints, **and** the built React
  dashboard (static files) — all on a single HTTP port. No separate web host or
  reverse proxy to wire up.
- **State lives in PostgreSQL.** The platform keeps its working set in memory and
  snapshots it to a `platform_state` table (JSONB), restoring on boot. This
  survives restarts and redeploys on an ephemeral filesystem.
- **Single instance.** Charge points hold long-lived WebSocket sessions and the
  live state is in-process, so run **one** instance and scale **up** (bigger box),
  not out. (Horizontal scaling would require sharding chargers across nodes — out
  of scope here.)

```
            ┌───────────────── DigitalOcean ─────────────────┐
 EV charger │   wss://csms.example.com/ocpp/<id>             │
 ──────────▶│  ┌──────────────┐        ┌──────────────────┐  │
 browser    │  │  CSMS (Node) │◀──────▶│  Managed Postgres │  │
 ──────────▶│  │  API+WS+web  │        └──────────────────┘  │
 https://…  │  └──────────────┘                              │
            └────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

- A DigitalOcean account.
- A domain you can point at the app (recommended — chargers should connect over
  **`wss://`**, which needs TLS, which DO terminates for you on a real hostname).
- The repo pushed to GitHub (App Platform deploys from a branch).
- `JWT_SECRET` — generate one: `openssl rand -hex 32`.

---

## 3. Option A — DigitalOcean App Platform (recommended)

App Platform builds the `Dockerfile`, gives you HTTPS + WebSockets automatically,
and provisions a managed Postgres alongside.

### 3.1 Using the App Spec (`.do/app.yaml`)

1. Edit `.do/app.yaml`:
   - `github.repo` / `branch` → your fork and the branch to deploy.
   - `JWT_SECRET` → paste a strong secret (or set it as an encrypted secret in the UI).
2. Create the app:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
   The spec also declares a managed PostgreSQL 16 database named `db` and binds its
   connection string into the app as `DATABASE_URL` via `${db.DATABASE_URL}`, and
   the app's own URL into `PUBLIC_URL` via `${APP_URL}`.
3. Watch the build/deploy:
   ```bash
   doctl apps list
   doctl apps logs <app-id> --type run --follow
   ```

### 3.2 Or via the UI

1. **Create App → GitHub →** pick the repo/branch. App Platform auto-detects the
   `Dockerfile`.
2. **Add a Database →** Dev database, PostgreSQL.
3. **App-level env vars** (Settings → the `csms` service):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `${db.DATABASE_URL}` |
   | `DATABASE_SSL` | `true` |
   | `PUBLIC_URL` | `${APP_URL}` |
   | `JWT_SECRET` | _your secret_ (mark **Encrypt**) |
   | `OCPI_COUNTRY_CODE` / `OCPI_PARTY_ID` | e.g. `US` / `VLT` |
   | `ANTHROPIC_API_KEY` | _(optional)_ enables the AI assistant |
   | `STRIPE_SECRET_KEY` | _(optional)_ enables real payments |
4. Set **HTTP port = 8080**, **health check path = `/healthz`**, **instances = 1**.
5. Deploy. Your app is at `https://<app>.ondigitalocean.app` (or your custom domain).

> App Platform supports WebSockets on the standard HTTPS port, so charge points
> connect to `wss://<your-domain>/ocpp/<id>` with no extra configuration.

---

## 4. Option B — DigitalOcean Droplet (Docker Compose)

For a single VM you control:

1. Create an Ubuntu Droplet, install Docker + the Compose plugin.
2. Clone the repo and configure env:
   ```bash
   git clone https://github.com/chordsnstrings/ahmedworkoutapp.git
   cd ahmedworkoutapp
   cp .env.example .env
   nano .env          # set POSTGRES_PASSWORD, JWT_SECRET, PUBLIC_URL
   ```
3. Launch (builds the image, starts Postgres + the app):
   ```bash
   docker compose up -d --build
   docker compose logs -f app
   ```
4. **TLS / `wss://`.** Put a TLS-terminating reverse proxy in front (Caddy makes
   this one line). Example `Caddyfile`:
   ```
   csms.example.com {
       reverse_proxy localhost:8080
   }
   ```
   Caddy auto-provisions a Let's Encrypt cert; chargers then use
   `wss://csms.example.com/ocpp/<id>`. (Caddy proxies WebSocket upgrades by default.)

---

## 5. Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` (App Platform sets `8080`) | HTTP + OCPP WebSocket port |
| `DATABASE_URL` | _(empty → file snapshot)_ | Postgres connection string; enables DB persistence |
| `DATABASE_SSL` | auto | Force TLS to the DB (auto-on for `sslmode=require` / DO hosts) |
| `JWT_SECRET` | dev default | **Set this** — signs dashboard auth tokens |
| `PUBLIC_URL` | `http://localhost:3000` | Public base URL advertised for OCPI |
| `WEB_DIST` | `../web/dist` | Override the served dashboard directory |
| `OCPP_HEARTBEAT_INTERVAL` | `60` | Heartbeat interval (s) returned to stations |
| `OCPP_OFFLINE_AFTER_MS` | `90000` | Silence before a charger is marked offline |
| `CURRENCY` | `USD` | Default billing currency |
| `OCPI_COUNTRY_CODE` / `OCPI_PARTY_ID` | `US` / `VLT` | OCPI party identity |
| `ANTHROPIC_API_KEY` | _(empty)_ | Enables the Claude ops assistant |
| `STRIPE_SECRET_KEY` | _(empty)_ | Enables real Stripe payments |
| `API_KEY` | _(empty)_ | Legacy API-key gate (auth tokens are primary) |

---

## 6. First login & hardening

- Sign in at your URL with the seeded admin: **`admin@local` / `admin123`**.
- **Immediately**: create your own admin user (Users & Roles), then delete or
  change the seeded demo accounts (`admin@local`, `ops@local`, `view@local`).
- Confirm `JWT_SECRET` is set to a strong, non-default value (otherwise tokens are
  forgeable).
- Set **branding** (Settings) and your real **tariffs** before taking live sessions.
- The demo also seeds example chargers/RFID/contracts — remove what you don't need.

---

## 7. Connecting real charge points (getting live data)

### 7.1 Point the charger at the CSMS

In the charge point's configuration (web UI, installer app, or `ChangeConfiguration`),
set the **Central System / OCPP URL** to:

```
wss://<your-domain>/ocpp/<chargePointId>
```

- `<chargePointId>` is the station's identity (e.g. its serial). It becomes the
  charger's id in the dashboard. Each station uses a **unique** id.
- The station must request OCPP as a **WebSocket subprotocol**:
  `ocpp1.6` or `ocpp2.0.1`. The server negotiates whichever the station offers.
- Use `wss://` (TLS). Plain `ws://` only works for local testing.

> Authentication: this build accepts any station that presents a valid id +
> supported subprotocol (OCPP "Security Profile 1" style, no per-charger secret).
> For production, terminate TLS (done by DO/Caddy) and restrict who can reach the
> endpoint; per-charger Basic-Auth / Security Profile 2–3 is a future hardening step.

### 7.2 Authorize a card

Add the driver's RFID id-tag under **Access / RFID** (or assign it to a **Driver**
with a wallet). Without an accepted token, `Authorize`/`StartTransaction` is
rejected — which you'll see live in the OCPP log.

### 7.3 Verify live data is flowing

1. **Charge Points** — the station appears and turns **Online** after its
   `BootNotification` / first `Heartbeat`.
2. **Live OCPP Log** — watch `BootNotification`, `StatusNotification`, `Heartbeat`
   stream in real time (CALL → CALLRESULT).
3. **Observability** — message throughput, latency, and the connection count rise.
4. Start a charge (plug in / swipe): a session appears under **Sessions** with live
   power and **State of Charge**; **Overview** energy/revenue update.

### 7.4 No hardware yet? Simulate against the live URL

The included simulator speaks real OCPP and can target your deployment:

```bash
# from a clone of the repo
npm install
npm run simulator -w server -- --id FIELD-TEST-1 --version 2.0.1 --url wss://<your-domain>
# OCPP 1.6 RFID, or Plug & Charge:
npm run simulator -w server -- --id FIELD-TEST-2 --version 1.6 --idTag RFID-0001
npm run simulator -w server -- --id PNC-1 --version 2.0.1 --idType eMAID --idTag DE-8AA-CA12B34-9
```

A quick raw connectivity check with `wscat`:

```bash
npx wscat -c wss://<your-domain>/ocpp/PROBE -s ocpp2.0.1
> [2,"1","BootNotification",{"reason":"PowerUp","chargingStation":{"model":"probe","vendorName":"probe"}}]
# expect: [3,"1",{"status":"Accepted","currentTime":"…","interval":60}]
```

### 7.5 Roaming (optional)

Under **Roaming (OCPI)**, register an eMSP/hub partner to mint its access token.
They then call your OCPI endpoints (shown on that page) with
`Authorization: Token <token>` to pull Locations, Sessions and CDRs.

---

## 8. Operating notes

- **Backups:** your data is the `platform_state` row in Postgres. Use DO's managed
  database backups (App Platform) or `pg_dump` (Droplet).
- **Logs:** `doctl apps logs <id> --follow` or `docker compose logs -f app`.
- **Redeploys** are safe — state is reloaded from Postgres on boot; chargers
  reconnect automatically.
- **Health:** `GET /healthz` returns `{ ok: true }` unauthenticated for probes.
