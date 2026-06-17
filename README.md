# Apex — 90-Day Transformation Tracker

A beautiful, fluid, **offline-first** workout tracker built for a focused 90-day transformation.
No backend, no sign-up, no server database — **all your data lives on your device** in IndexedDB,
and the app installs to your phone's home screen as a PWA.

![Apex icon](public/pwa-192x192.png)

## Why it's different

- **Guided + flexible.** Follow a periodized 90-day Push/Pull/Legs program that tells you exactly
  what to train today — then freely swap, add, or remove exercises from a pre-loaded library of
  ~70 common gym movements.
- **Fluid logging.** Tap to log a set, see *last session's numbers to beat*, auto-filled weights,
  and an automatic rest timer that follows you across the app.
- **Progress that motivates.** A Day-X/90 progress ring, streaks, training-volume and bodyweight
  charts, automatic personal-record detection with a celebration, and before/after photos.
- **Yours forever.** Works fully offline. Export/import a JSON backup anytime.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling | Tailwind CSS (dark, vibrant theme) |
| Animation | Framer Motion |
| Local NoSQL store | Dexie.js (IndexedDB) + live queries |
| Charts | Recharts |
| Offline / install | vite-plugin-pwa (Workbox) |
| State | Zustand (active workout & rest timer) |

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
```

Build & preview the production PWA:

```bash
npm run build
npm run preview
```

## How the data is stored

Everything is a document in IndexedDB via Dexie (see `src/db/`):

- `exercises` — the seeded library + any custom exercises you add
- `programDays` — the 90-day Push/Pull/Legs template
- `workouts` / `setLogs` — your sessions and every logged set
- `bodyStats` / `photos` — bodyweight, measurements, progress photos (stored as Blobs)
- `personalRecords` — cached PRs per exercise
- `settings` — units, rest duration, goal, start date

Weights are stored canonically in **kg** and displayed in your chosen unit. Estimated 1RM uses the
Epley formula. Use **Settings → Export backup** to download all of it as JSON.

## Project structure

```
src/
  db/        Dexie schema, seeding, repository (workout operations)
  data/      Pre-populated exercise library + 90-day program generator
  lib/       Units, 1RM, streaks, PR detection, dates, backup
  store/     Zustand stores (rest timer)
  hooks/     Live-query React hooks
  components/ ProgressRing, SetRow, RestTimerBar, sheets, etc.
  screens/   Onboarding, Home, WorkoutPlayer, Library, Progress, History, Settings
```
