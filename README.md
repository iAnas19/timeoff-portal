# ExampleHR Time-Off (Take-Home)

Frontend for employee time-off balances and manager approvals. HCM is the source of truth; the UI uses optimistic updates and explicit reconciliation states.

## Documentation

- **[Technical Requirements (TRD)](docs/TRD.md)** — architecture, state model, API contract, test strategy
- **[Build phases](PHASES.md)** — resume work by phase number in any chat session
- **[Cursor rules](.cursorrules)** — implementation standards

## Requirements

- **Node.js 24.14.1** (see `.nvmrc`)

```bash
node -v   # should print v24.14.1
```

## Setup

```bash
npm ci
cp .env.example .env.local   # adjust if needed
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit/integration |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright (starts dev server) |
| `npm run storybook` | Storybook on http://localhost:6006 |
| `npm run build-storybook` | Static Storybook build |

## Routes (Phase 1)

| Path | Description |
|------|-------------|
| `/` | Home |
| `/employee` | Employee view (Phase 5–6) |
| `/manager` | Manager view (Phase 7) |

## Progress

See checkboxes in `PHASES.md`. **Phase 0** (TRD) and **Phase 1** (scaffold) are complete.
