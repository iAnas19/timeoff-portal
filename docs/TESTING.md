# Test Strategy & Coverage

The value of this submission is in the rigor of the tests, not the line count. Each
layer is chosen to guard a *specific* class of regression. The reconciliation logic
(optimistic prediction vs. authoritative HCM truth) is the highest-risk area and gets
the deepest coverage.

## How to run

```bash
npm test            # all Vitest suites (unit + service + container-hook)
npm run test:watch  # watch mode
npm run test:e2e    # Playwright (requires: npx playwright install)
npm run storybook   # visual state matrix
```

Coverage report (v8 provider):

```bash
npx vitest run --coverage   # writes coverage/ (lcov + html)
```

## What each layer guards

| Layer | File(s) | Guards against |
|-------|---------|----------------|
| Pure utils | `features/balances/balance.utils.test.ts` | Math bugs in available-balance, optimistic deduction (capping), silent-failure / external-change detection |
| Mock HCM store | `mocks/store.test.ts` | The simulated source of truth: writes, insufficient-balance & invalid-dimension rejections, one-shot armed scenarios (silent-fail / conflict), anniversary increment |
| Service + client (MSW) | `shared/api/client.test.ts`, `shared/api/serviceErrors.test.ts` | Contract drift; Zod-strict rejection of malformed responses; **every `HCMErrorCode`** mapped to a typed error (INVALID_DIMENSION, NETWORK, TIMEOUT, UNKNOWN at the service layer; INSUFFICIENT_BALANCE / CONFLICT / SILENT_FAILURE through the hooks) |
| Container hooks (RTL) | `features/balances/useBalances.test.tsx`, `features/requests/useSubmitRequest.test.tsx`, `features/approvals/useApprovals.test.tsx` | The reconciliation behaviors — see below |
| Component states | `*.stories.tsx` | Every `BalanceDisplayStatus` / form / approval state is rendered and PM-reviewable |
| E2E (Playwright) | `tests/e2e/*` *(pending)* | Full pipeline: submit → manager approve; anniversary mid-session; silent-fail recovery |

## Behavioral guarantees locked by the hook tests

These are the regressions that previously slipped through and are now pinned:

- **Silent failure is detected** (`useSubmitRequest`): HCM returns 200 but the balance
  never changed → `submit-silent-conflict` + `hcm-silent-conflict` banner. This is the
  dedicated silent-failure test the brief calls mandatory; it fails if `onSettled`
  reconciliation is removed.
- **Anniversary surfaces, never silently** (`useBalances`): an external balance change
  reported by a poll produces `refreshed-mid-session` and is dismissable.
- **A poll cannot clobber an optimistic deduction**: the deduction is derived on top of
  the authoritative cell, so a concurrent poll composes rather than overwrites.
- **Explicit rejection ≠ rolled-back ≠ error** (`useSubmitRequest`): insufficient balance
  → `hcm-rejected`, with the cell visibly `optimistic-rolled-back`.
- **Manager decides on a valid balance** (`useApprovals`): `pending-fresh-balance` vs
  `pending-stale-balance` (live cell differs from queue-time), `conflict-on-approve` on
  409, and the request leaves the queue after a successful approval.

## Determinism

Every suite resets the in-memory store (`resetStore`) and uses a fresh `QueryClient`
per test, and resets MSW handlers in `afterEach`. No shared mutable state across tests.
The test timeout (`HCM_API_TIMEOUT_MS=2000` in `vitest.config.ts`) keeps the abort/TIMEOUT
path fast and deterministic.
