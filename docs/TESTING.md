# Test Strategy & Coverage

The value of this submission is the rigor of the tests, not the line count. Each layer
guards a *specific* class of regression. The reconciliation logic (optimistic prediction
vs. authoritative HCM truth) is the highest-risk area and gets the deepest coverage.

## How to run

```bash
npm test               # Vitest: unit + component + service + container-hook (71 tests)
npm run test:coverage  # Vitest with v8 coverage → ./coverage (html + lcov)
npm run test:e2e       # Playwright: 3 end-to-end flows against a production build
npm run storybook      # Storybook UI-state matrix (then, in another shell:)
npm run test-storybook # run every story's play/smoke test headlessly (needs Storybook on :6006)
```

## Coverage snapshot (v8)

```
Statements : 79.9%   Branches : 68.9%   Functions : 79.8%   Lines : 80.0%
```

Thin route/page shells (`src/app/**`) and generated files are excluded; the mock HCM,
features, hooks, utils, and shared client are all included. Report: `coverage/index.html`.
Per the brief, line coverage is a floor — the **behavioral matrix** below is the goal.

## What each layer guards

| Layer | File(s) | Guards against |
|-------|---------|----------------|
| Pure utils | `features/balances/balance.utils.test.ts` | available-balance math, optimistic deduction (capping), silent-failure & external-change detection, inclusive day counting |
| Mock HCM store | `mocks/store.test.ts` | The simulated source of truth: writes, insufficient/invalid rejections, **duplicate-overlap** rejection, one-shot armed scenarios, anniversary, **rate-limit (429)** and **CORS** |
| Service + client (MSW) | `shared/api/client.test.ts`, `shared/api/serviceErrors.test.ts` | Contract drift; Zod-strict rejection; **every `HCMErrorCode`** mapped to a typed error (INVALID_DIMENSION/NETWORK/TIMEOUT/UNKNOWN at the service layer; INSUFFICIENT_BALANCE/CONFLICT/SILENT_FAILURE through the hooks) |
| Container hooks (RTL) | `features/*/use*.test.tsx` | The reconciliation behaviors — see below |
| Component (RTL) | `features/*/{BalanceCard,RequestForm,ManagerApprovalCard}.test.tsx` | Each presenter renders the right label/badge/banner per status; form validation messages; disabled/exhausted states |
| Storybook interaction | `*.stories.tsx` via `test-storybook` | Every UI state renders without error; `play` interactions hold (24 stories, run headlessly) |
| E2E (Playwright) | `tests/e2e/*.spec.ts` | Full pipeline against a prod build: **submit → manager approve**, **anniversary mid-session**, **silent-fail recovery** |

## Behavioral guarantees locked by the hook tests

- **Silent failure is detected** (`useSubmitRequest`): HCM returns 200 but the balance never
  changed → `submit-silent-conflict` + banner. The dedicated test the brief calls mandatory;
  it fails if `onSettled` reconciliation is removed.
- **Anniversary surfaces, never silently** (`useBalances`): an external balance change a poll
  reports produces `refreshed-mid-session`, and is dismissable.
- **A poll cannot clobber an optimistic deduction**: the deduction is derived on top of the
  authoritative cell, so a concurrent poll composes rather than overwrites.
- **Explicit rejection ≠ rolled-back ≠ error** (`useSubmitRequest`): insufficient balance →
  `hcm-rejected`, with the cell visibly `optimistic-rolled-back`.
- **No double-booking**: overlapping dates for the same cell are rejected (409).
- **Manager decides on a valid balance** (`useApprovals`): `pending-fresh-balance` vs
  `pending-stale-balance`, `conflict-on-approve` on 409, and the request leaves the queue on success.

## Determinism

Vitest: each test resets the in-memory store (`resetStore` clears balances, requests, armed
flags, and the rate-limit window) and uses a fresh `QueryClient`; MSW handlers reset in
`afterEach`; the DOM is cleaned after every test. `HCM_API_TIMEOUT_MS=2000` keeps the
abort/TIMEOUT path fast.

E2E: the mock HCM is one shared in-memory store, so specs run **serially** (`workers: 1`),
each calling a test-only `POST /api/hcm/simulate/reset` first. They run against a
**production build** (`next build && next start`) to avoid dev/HMR flakiness.
