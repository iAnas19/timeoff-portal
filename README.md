# ExampleHR — Time-Off Frontend

A frontend for employees to view per-location leave balances and submit time-off requests, and for managers to approve/deny them — while treating an external **HCM** (Workday/SAP-style) as the **source of truth**.

The hard problem this solves: show balances that feel **instant** but stay **honest**, when the real numbers live in a system we don't control and can change underneath us. The UI predicts optimistically, then **reconciles** against HCM — and surfaces any contradiction (a rejection, a silent no-op, an anniversary bonus) instead of hiding it.

> Full design rationale: **[docs/TRD.md](docs/TRD.md)**. Test strategy: **[docs/TESTING.md](docs/TESTING.md)**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · TanStack Query v5 · Zod · MSW · Vitest + Testing Library · Playwright · Storybook 10.

State: **TanStack Query** owns all server data, polling, mutations, and the per-cell reconciliation banners (kept in the cache). UI state is component-local. (Why no Redux/Zustand: see TRD §4.)

## Run it

Requires **Node 24.14.1** (`.nvmrc`).

```bash
npm ci
cp .env.example .env.local      # values are fine as-is for local dev
npm run dev                     # http://localhost:3000
```

| Path | What |
|------|------|
| `/employee` | Per-location balances + the request form |
| `/manager` | Pending-approval queue with live balance context |
| `/api/hcm/*` | The mock HCM (Next.js route handlers) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run test` | Vitest — unit, component, service-contract (MSW), and container-hook tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with v8 coverage → `coverage/` |
| `npm run test:e2e` | Playwright end-to-end against a production build (installs a browser on first run) |
| `npm run storybook` | Storybook — the full UI-state matrix (http://localhost:6006) |
| `npm run test-storybook` | Run every story's interaction test headlessly (Storybook must be running) |
| `npm run build-storybook` | Static Storybook build |

## How the data flow works (short version)

```
Employee:  batch GET (hydrate) → per-cell GET polls every 30s (authoritative)
           submit → optimistic prediction → POST → reconcile on settle
                 ↳ matches → success   ↳ HCM "no" → rejected   ↳ 200 but no change → silent-conflict
Manager:   GET pending queue + live per-cell balance → approve/deny (PATCH) → invalidate + refetch
External:  a poll that sees a changed balance (e.g. anniversary) → "refreshed mid-session" banner
```

A single client (`src/shared/api/client.ts`) → the mock HCM router (`src/mocks/router.ts`, shared by the Next route handler **and** MSW) → an in-memory store that behaves like a real, occasionally-misbehaving HCM.

## Try the interesting cases (Employee page → "Demo scenarios")

The mock is **deterministic** — nothing happens randomly. You trigger each case:

- **Anniversary bonus** — HCM adds a day to your *granted* balance server-side; the next poll shows it with a *"balance updated by HCM"* banner. (Models "balances refresh underneath you.")
- **Arm silent fail** — the next write returns `200 OK` but doesn't persist. Looks like success over HTTP; only reconciliation catches it → *"accepted but balance didn't change — verify."*
- **Arm conflict** — the next write returns `409`. On the manager side: *conflict-on-approve*.

Or via the API (all `/api/hcm/*` calls need the header `x-mock-auth: demo`):

```bash
curl -H "x-mock-auth: demo" http://localhost:3000/api/hcm/balances/batch
curl -X POST -H "x-mock-auth: demo" -H "Content-Type: application/json" \
     -d '{"employeeId":"emp-001"}' http://localhost:3000/api/hcm/simulate/anniversary
# also: /simulate/silent-fail · /simulate/conflict · /simulate/slow
```

Mock HCM security: mutating routes are **rate-limited** (429 on a burst), bodies are **Zod-validated**, and **CORS** is an explicit origin allowlist with preflight handling (no wildcard).

## Testing

`npm run test` runs the Vitest suite — pure utils, the mock store, service-layer contract tests (every `HCMError` code), and container-hook integration tests covering the reconciliation behaviors (optimistic rollback, silent-fail detection, anniversary refresh, manager fresh/stale, duplicate-booking). Storybook proves every UI state. See **[docs/TESTING.md](docs/TESTING.md)** for what each layer guards and why.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR:

- **verify** — `lint` → `test:coverage` → `build` → `npm audit --audit-level=high` (high-severity vulns block the build)
- **e2e** — Playwright against a production build
- **storybook** — every story's interaction test, headless

## Deploy (Vercel)

The app is server-rendered Next.js, so **Vercel** is the natural host (it runs the App
Router pages **and** the `/api/hcm/*` route handlers).

1. Import the repo at [vercel.com/new](https://vercel.com/new) — Vercel auto-detects Next.js (no `vercel.json` needed).
2. Set environment variables (from `.env.example`): `HCM_API_URL` (any valid URL — the browser uses relative paths, this is a server-side placeholder), `NEXT_PUBLIC_APP_ENV=production`.
3. Deploy. `/`, `/employee`, `/manager` all work on reload — **no rewrite config is required**. (The "nested route 404 on reload" problem only affects *static SPA* hosts; it does not apply to Next.js on Vercel.)

> **Demo caveat:** the mock HCM uses an in-memory store. On Vercel's serverless functions
> that state is per-instance and resets on cold starts, so a deployed demo may occasionally
> reset balances. It is fully consistent locally (`npm run dev` / `npm start`), which is the
> intended way to exercise the full scenario matrix.

**Storybook** is a separate static build (`npm run build-storybook` → `storybook-static`).
Deploy it as its own Vercel project (build command `npm run build-storybook`, output
`storybook-static`) or to Chromatic — or just run it locally with `npm run storybook`.

## More docs

- **[docs/TRD.md](docs/TRD.md)** — architecture, state model, reconciliation, API contract, alternatives considered
- **[docs/TESTING.md](docs/TESTING.md)** — test strategy and coverage
- **[PHASES.md](PHASES.md)** — build phases / progress
- **[.cursorrules](.cursorrules)** — implementation standards
