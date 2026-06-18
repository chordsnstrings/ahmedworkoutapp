# OCPP Platform — CSMS + Dashboard

A self-contained **Central System (CSMS)** for EV charging, speaking **OCPP 1.6J**
and **OCPP 2.0.1** over WebSocket, with a polished, responsive, **multi-tenant**
web dashboard for Charge Point Operators (CPOs).

> Charge points connect over OCPP-J; operators monitor and control their network
> from the dashboard in real time.

## Features

**Central System (server)**
- OCPP **1.6J** and **2.0.1** on the same endpoint — version negotiated via WebSocket subprotocol.
- Inbound handling: BootNotification, Heartbeat, StatusNotification, Authorize,
  Start/StopTransaction (1.6), TransactionEvent (2.0.1), MeterValues, DataTransfer, FirmwareStatus.
- Outbound remote control: Remote Start/Stop, Reset (soft/hard), Change Availability,
  **Set Charging Profile** (dynamic load management / current limiting), Trigger Message.
- **Access control**: RFID/id-token authorization list (Accepted / Blocked / Expired).
- **Billing**: per-kWh, per-hour and session-fee tariffs with automatic session costing.
- **Multi-tenant**: charge points grouped under operators (tenants); data is scoped per operator.
- Live **Server-Sent-Events** stream + REST API for the dashboard.
- In-memory store seeded with demo stations and 2 weeks of history (swap for a DB later).

**Operations & monetization**
- **Dynamic Load Management**: load groups with a kW budget; available current is
  auto-distributed across charging connectors via SetChargingProfile.
- **Alerts & uptime**: fault/offline alerts (acknowledge, topbar bell) and a rolling
  per-charger uptime % / 24h fault count.
- **Reservations**: OCPP ReserveNow / CancelReservation with expiry and auto-consume.
- **Dynamic pricing**: time-of-use windows and access-group tariff targeting.
- **Auth & RBAC**: token login with admin / operator / viewer roles; viewers are read-only.
- **Payments**: invoices auto-generated for paid sessions, collection via a mock
  gateway (or real Stripe PaymentIntents when `STRIPE_SECRET_KEY` is set), and
  **ad-hoc guest charging** through a public QR page (`/charge/<id>`).

**Persistence, audit & reporting**
- Durable state: the whole domain (chargers, sessions, tokens, tariffs, contracts,
  partners, invoices, load groups, DR events, users…) is snapshotted to disk and
  restored on boot, surviving restarts (`DATA_DIR`, default `./data`).
- **Audit log** of every mutating operator action (admin-only view).
- **Reports** page with CSV exports for sessions, invoices and OCPI CDRs.

**Energy management (solar · battery · V2G · demand response)**
- Load groups carry on-site solar, battery and SoC; the DLM rebalances against an
  **effective budget** = nominal + solar + battery − active curtailment.
- Schedulable **demand-response events** (curtail or V2G) that shed kW from a group
  for a window, auto-activate/expire, and immediately re-throttle live sessions.
- Energy & DR dashboard with per-group effective-vs-nominal capacity bars.

**ISO 15118 Plug & Charge**
- Contract-certificate (eMAID) store with valid/revoked/expired states; OCPP 2.0.1
  `Authorize` and `TransactionEvent` authorize eMAID id-tokens against it, plus a
  `Get15118EVCertificate` handler. Per-charger Plug & Charge enrolment toggle.
- The simulator can drive a Plug & Charge session: `--idType eMAID`.

**Roaming (OCPI 2.2.1)**
- A CPO-facing OCPI module exposing version discovery, credentials, **Locations**
  (chargers → EVSEs/connectors), **Sessions**, **CDRs**, and real-time **Token**
  authorization — all behind OCPI `Authorization: Token …` partner auth.
- Register eMSP / hub partners from the dashboard to mint their access token;
  view shared locations, generated CDRs (with VAT), and your OCPI endpoint URLs.

**OCPP remote management**
- Remote configuration (GetConfiguration/ChangeConfiguration · GetVariables/SetVariables),
  firmware OTA (UpdateFirmware) with live status, and diagnostics/log upload.

**AI ops assistant**
- A Claude-powered chat (`/assistant`) that answers natural-language questions about
  the network and traces root causes for faults/offline chargers, using a live
  snapshot of chargers, alerts, sessions and metrics. Responses stream token-by-token.
- Uses the official Anthropic SDK with model `claude-opus-4-8` (configurable via
  `ASSISTANT_MODEL`). Without `ANTHROPIC_API_KEY` it falls back to a deterministic
  computed briefing, so the feature still works in development.

**Dashboard (web)**
- Overview with at-a-glance KPIs, 14-day energy/revenue chart, "charging now", recent sessions.
- Charge-point list & detail with live connector status, power, and a full remote-control panel.
- Sessions ledger with energy, duration and cost.
- RFID/access management, tariff management, live OCPP message inspector.
- **White-label** branding (name, accent colour, currency).
- Fully **responsive** (mobile drawer nav) and installable as a **PWA** (offline shell).
- Operator switcher in the top bar to scope the whole UI to one tenant.

## Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript everywhere |
| CSMS | Node.js, `ws` (OCPP-J), Express (REST), SSE |
| Dashboard | React + Vite, Tailwind CSS, Recharts, lucide-react |
| Shared types | `@ocpp/shared` workspace package |
| Tooling | npm workspaces, `tsx` |

## Getting started

```bash
npm install
npm run dev          # starts CSMS (:3000) and dashboard (:5173) together
```

Then open <http://localhost:5173>.

Simulate charge points (no hardware needed):

```bash
npm run simulator -- --id CP_SIM_1 --version 1.6
npm run simulator -- --id CP_SIM_2 --version 2.0.1
```

The simulator boots, reports status, and runs a charging session you can watch
live on the dashboard — and it responds to Remote Start/Stop, Reset, etc.

## Connecting a real charge point

Point the station's OCPP-J URL at:

```
ws://<host>:3000/ocpp/<chargePointId>
```

requesting subprotocol `ocpp1.6` or `ocpp2.0.1`. New stations appear under the
**Unassigned** operator; assign them to a tenant from the charge-point detail page.

## Project structure

```
shared/   @ocpp/shared — RPC framing + version-agnostic DTOs
server/   CSMS: OCPP WebSocket server, handlers (1.6 & 2.0.1), REST API, SSE, store, simulator
web/      React dashboard (Vite + Tailwind), PWA
```

## Configuration (server env)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP + OCPP WebSocket port |
| `OCPP_HEARTBEAT_INTERVAL` | `60` | Heartbeat interval (s) returned to stations |
| `OCPP_OFFLINE_AFTER_MS` | `90000` | Silence before a charger is marked offline |
| `API_KEY` | _(empty)_ | Legacy API-key gate (auth tokens are the primary mechanism) |
| `CURRENCY` | `USD` | Default billing currency |
| `JWT_SECRET` | _(dev default)_ | Secret used to sign dashboard auth tokens — **set in production** |
| `STRIPE_SECRET_KEY` | _(empty)_ | When set, payments create real Stripe PaymentIntents; otherwise a mock gateway settles instantly |
| `ANTHROPIC_API_KEY` | _(empty)_ | Enables the Claude-powered ops assistant; without it a local computed briefing is returned |
| `ASSISTANT_MODEL` | `claude-opus-4-8` | Model used by the ops assistant |
| `DATA_DIR` | `./data` | Directory for the persisted state snapshot |
| `PUBLIC_URL` | `http://localhost:3000` | Base URL advertised for OCPI endpoints |
| `OCPI_COUNTRY_CODE` / `OCPI_PARTY_ID` | `US` / `VLT` | This CPO's OCPI party identity |

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@local` | `admin123` |
| Operator | `ops@local` | `ops12345` |
| Viewer | `view@local` | `view1234` |

## Roadmap

The original roadmap is now implemented: operator auth/RBAC, payments &
settlement, dynamic load management with demand response, reservations,
firmware/diagnostics, OCPI 2.2.1 roaming, ISO 15118 Plug & Charge, an AI ops
assistant, durable persistence, audit logging and reporting.

Further production hardening would swap the file-snapshot store for Postgres/
Timescale, add horizontal scaling/HA, OCPP Security Profile 3 (mTLS), a
driver-facing mobile app, and certified OCPP/OCPI conformance test suites.
