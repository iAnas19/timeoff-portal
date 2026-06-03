# ExampleHR Time-Off — Master Build Phases

**Purpose:** One file to resume work in any chat session. Say: *"Execute Phase N per PHASES.md and .cursorrules."*

**Authority:** `.cursorrules` is the implementation law. This file is the **order of operations**, **checklists**, and **done criteria**. If they conflict, `.cursorrules` wins on code style; this file wins on sequencing.

**Assignment deliverables (all phases must satisfy):**
| Deliverable | Produced in |
|-------------|-------------|
| Technical Requirement Document (TRD) | Phase 0 |
| Runnable app (employee + manager views) | Phases 4–6 |
| Mock HCM + data layer | Phases 2–3 |
| Test suite + coverage proof | Phase 8 |
| Storybook (one command) + optional deploy | Phases 7, 9 |

---

## How to use in a new chat

```
1. Read PHASES.md and .cursorrules fully.
2. Check "Progress tracker" below — do not redo completed phases.
3. Run ONLY the requested phase (or the next incomplete phase).
4. After finishing, update the Progress tracker checkboxes.
5. Do not skip acceptance criteria or code-generation order (Phase 1 → 2 before UI).
```

**Pinned dependencies (Phase 1):** No `^` or `~` in `package.json`. Run `npm audit` in CI (Phase 9).

---

## Progress tracker

Copy this block and update after each phase:

```
[x] Phase 0 — TRD
[x] Phase 1 — Scaffold & toolchain
[x] Phase 2 — Domain contracts (types, schemas, keys, constants)
[x] Phase 3 — Mock HCM (Next.js routes + MSW + fixtures)
[x] Phase 4 — Shared platform (config, client, errors, Query, UI primitives)
[x] Phase 5 — Balances feature (employee view foundation)
[x] Phase 6 — Requests feature (employee submit flow)
[x] Phase 7 — Approvals feature (manager view) + Storybook matrix
[~] Phase 8 — Test suite — DONE: utils, mock store, service+MSW error-mapping (every HCMErrorCode),
              container-hook tests (useBalances reconciliation, useSubmitRequest incl. dedicated
              silent-failure test, useApprovals). REMAINING: Storybook play as a CI test runner
              (vitest-storybook or test-runner) and Playwright e2e (submit→approve, anniversary,
              silent-fail recovery).
[ ] Phase 9 — CI, coverage proof, Storybook deploy, README

NOTE (architecture correction): the reconciliation "buffer" described in early phases was reworked.
The per-cell poll is now the always-authoritative cache value; the optimistic deduction is DERIVED
on top (composable overlay) so a poll can never clobber it. `refreshed-mid-session` fires from
comparing each poll's confirmedBalance to the last observed value. See TRD §7 and .cursorrules §8/§16.
Fixed along the way: perpetual-`stale` (staleTime 0 + isStale), overlay banners wiped by balance
invalidation (overlays moved out of the "balances" key tree), and fragile timeout detection.
```

---

## Guiding principles (never violate)

1. **HCM is source of truth** — optimistic UI is prediction only.
2. **Explicit states** — every `BalanceDisplayStatus` and request status is named, typed, rendered.
3. **Fail visibly** — no silent overwrites; banners for mid-session refresh and silent conflict.
4. **Defense in depth** — Zod at API boundaries; no raw `fetch` outside `shared/api/client.ts`.

---

## Phase 0 — Technical Requirement Document (TRD)

**Goal:** Written spec graders read *before* code. Agent implements from this + `.cursorrules`.

**Depends on:** Nothing.

**Output file:** `docs/TRD.md`

### Required TRD sections

1. **Problem statement** — fast UI vs external HCM truth; employee + manager personas.
2. **Constraints** — per-employee per-location balances; batch vs real-time read; silent HCM failures.
3. **Architecture diagram** — Page → Container → View; features vs `shared/`; no cross-feature imports.
4. **State management decision**
   - TanStack Query: all server state, polling, mutations, cache.
   - Zustand: UI chrome only (modals, tabs) — **never** balances or requests.
   - **Alternatives considered:** pessimistic-only UI (reject: too slow); Redux/global store for balances (reject: duplicates HCM).
5. **Optimistic update strategy**
   - `onMutate` snapshot + apply prediction.
   - `onError` restore snapshot.
   - **`onSettled` mandatory invalidation** — reconciliation step.
   - Never permanent "approved" until settled + cache consistent.
   - **Alternatives:** pessimistic submit (reject for employee UX); no rollback (reject).
6. **Cache & invalidation**
   - Hierarchical query keys (`BALANCE_KEYS`, `REQUEST_KEYS`, `APPROVAL_KEYS`).
   - Batch hydrate once; per-cell poll `BALANCE_POLL_INTERVAL_MS` (30s default).
   - `refetchIntervalInBackground: false`.
   - Invalidate broadest correct scope after mutations.
7. **Reconciliation buffer** (critical)
   - Background poll differs **while mutation in flight** → hold in buffer, do not clobber optimistic value.
   - After `onSettled` → flush buffer → may set `refreshed-mid-session`.
   - Diagram or numbered sequence for implementers.
8. **Display status model** — full `BalanceDisplayStatus` union + when each triggers.
9. **API contract** — list all mock endpoints (see Phase 3) + `HCMError` codes.
10. **Component tree map** — which container owns which queries/mutations per screen.
11. **Mock HCM behavior matrix** — anniversary, silent-fail, conflict, slow, insufficient balance, invalid dimension.
12. **Test strategy defense** — what each layer guards (table from `.cursorrules` §14); why silent-fail gets dedicated integration test.
13. **Security summary** — config gate, route auth, rate limits, no PII in URLs/logs.
14. **Out of scope** — real auth provider, real Workday/SAP, i18n, mobile native.

### Acceptance criteria

- [ ] TRD exists at `docs/TRD.md` and is self-contained (grader does not need chat history).
- [ ] Optimistic vs pessimistic and buffer flush are explained with rejected alternatives.
- [ ] Test pyramid table included with regression rationale per layer.

---

## Phase 1 — Scaffold & toolchain

**Goal:** Empty but runnable monorepo layout; all tools configured; no business features yet.

**Depends on:** Phase 0 recommended (TRD can finalize in parallel).

### Create

- Next.js App Router + TypeScript **strict**
- Folder skeleton per `.cursorrules` §2 (`src/app`, `src/features/{balances,requests,approvals}`, `src/shared`, `src/mocks`, `src/tests`)
- `.env.example` with vars validated in Phase 4
- `package.json` with **pinned** versions (no `^`/`~`)

### Packages to install

| Category | Packages |
|----------|----------|
| Core | `next`, `react`, `react-dom`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom` |
| Data | `@tanstack/react-query`, `zustand`, `immer`, `zod` |
| Test | `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `msw` |
| E2E | `@playwright/test` |
| Storybook | `storybook`, `@storybook/nextjs`, `@storybook/addon-essentials`, `@storybook/addon-interactions`, `@storybook/test`, `msw-storybook-addon` |
| Utils | `nanoid` or `uuid` (correlation IDs) |
| Dev | `eslint`, `eslint-config-next`, `prettier` (optional) |

### Scripts (minimum)

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "next lint",
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"storybook": "storybook dev -p 6006",
"build-storybook": "storybook build"
```

### Acceptance criteria

- [ ] `npm run build` succeeds (minimal home page OK).
- [ ] `npm run test` runs (zero or placeholder tests OK).
- [ ] `npm run storybook` starts.
- [ ] `src/` layout matches `.cursorrules` §2.
- [ ] README stub points to `docs/TRD.md` and `PHASES.md`.

---

## Phase 2 — Domain contracts (no UI, no route bodies)

**Goal:** Types, schemas, keys, constants, service signatures, state-transition maps. Follow `.cursorrules` §17 steps 1–5.

**Depends on:** Phase 1.

### 2a — Shared

| Artifact | Path |
|----------|------|
| `HCMError`, `HCMErrorCode` | `src/shared/types/error.types.ts` |
| Error envelope Zod schema | `src/shared/schemas/` |
| Error factory | `src/shared/api/errors.ts` (or equivalent) |
| Config schema (no `process.env` elsewhere yet) | `src/shared/config/config.ts` |

### 2b — Balances feature

| Artifact | Path |
|----------|------|
| `BalanceDisplayStatus` + related domain types | `src/features/balances/types/` |
| Balance/request Zod schemas (`.strict()`) | `src/features/balances/schemas/` |
| `BALANCE_KEYS` | `src/features/balances/queryKeys/balanceKeys.ts` |
| Named constants (`BALANCE_POLL_INTERVAL_MS`, etc.) | `src/features/balances/constants/` |
| Pure utils (signatures + tests stub): `calculateAvailableBalance`, `applyOptimisticDeduction`, reconciliation helpers | `src/features/balances/utils/` |
| Service signatures only: `fetchBalanceBatch`, `fetchBalance`, `writeBalance` | `src/features/balances/services/` |

### 2c — Requests feature

| Artifact | Path |
|----------|------|
| Request types + status union | `src/features/requests/types/` |
| Schemas | `src/features/requests/schemas/` |
| `REQUEST_KEYS` | `src/features/requests/queryKeys/` |
| Constants | `src/features/requests/constants/` |
| Service signatures: `submitTimeOffRequest`, `patchRequest` | `src/features/requests/services/` |
| State transition map (document in code comment or `docs/state-maps.md`) | idle → validating → submitting → success / rolled-back / rejected / silent-conflict |

### 2d — Approvals feature

| Artifact | Path |
|----------|------|
| Approval types | `src/features/approvals/types/` |
| Schemas | `src/features/approvals/schemas/` |
| `APPROVAL_KEYS` | `src/features/approvals/queryKeys/` |
| Service signatures: `fetchPendingApprovals`, `approveRequest`, `denyRequest` | `src/features/approvals/services/` |

### Acceptance criteria

- [ ] No `any`; types inferred from Zod where applicable.
- [ ] Query keys hierarchical; **zero** inline `["balances", ...]` in codebase.
- [ ] `BalanceDisplayStatus` includes all 10 states from `.cursorrules` §9.
- [ ] Vitest unit tests for pure utils (happy path + at least one edge case).

---

## Phase 3 — Mock HCM (Next.js routes + MSW + fixtures)

**Goal:** Deterministic fake HCM with real logic for scenarios. Same contracts as production services will call.

**Depends on:** Phase 2.

### 3a — In-memory store & fixtures

| Artifact | Path |
|----------|------|
| Seed employees, locations, balances | `src/mocks/fixtures/` |
| Scenario flags (silent-fail next write, conflict, slow delay) | `src/mocks/scenarios/` |
| Shared store module (single source for route handlers) | e.g. `src/mocks/store/` |

**Rules:** Fixed IDs; randomness only via simulate endpoints.

### 3b — Next.js route handlers (required)

Implement under `src/app/api/hcm/`:

```
GET    /api/hcm/balances/batch
GET    /api/hcm/balances/[employeeId]/[locationId]
POST   /api/hcm/balances/[employeeId]/[locationId]
POST   /api/hcm/requests
PATCH  /api/hcm/requests/[requestId]
POST   /api/hcm/simulate/anniversary
POST   /api/hcm/simulate/silent-fail
POST   /api/hcm/simulate/conflict
POST   /api/hcm/simulate/slow
```

**Per-handler requirements (`.cursorrules` §12, §15):**
- Authenticate first (mock auth acceptable: header or cookie check).
- Validate body/query with shared Zod schemas → 400 on invalid.
- Mutations: rate limiting.
- Errors: sanitized `HCMError` JSON, never stack traces to client.
- **Anniversary:** increment balance server-side.
- **Silent-fail:** next write returns 200 but does not persist; GET unchanged.
- **Conflict:** next write returns 409 `CONFLICT`.
- **Slow:** next request 6–12s random delay.
- Reject insufficient balance / invalid dimension with proper `HCMErrorCode`.

### 3c — MSW handlers

| Artifact | Path |
|----------|------|
| Handlers mirroring same paths/status codes | `src/mocks/handlers/` |
| Browser + Node setup for Storybook and Vitest | `src/mocks/browser.ts`, `src/mocks/server.ts` |

### Acceptance criteria

- [ ] Manual or Vitest smoke: batch GET returns corpus; cell GET authoritative; POST write updates store unless silent-fail armed.
- [ ] Simulate endpoints arm one-shot behaviors correctly.
- [ ] MSW and route handlers stay in sync (shared types/schemas).

---

## Phase 4 — Shared platform (config, client, Query, UI primitives)

**Goal:** All HTTP goes through one client; QueryClient configured; app providers wired.

**Depends on:** Phases 2–3.

### Implement

| Artifact | Path |
|----------|------|
| `config.ts` — only `process.env` access | `src/shared/config/config.ts` |
| Fetch client: timeout, `x-request-id`, auth headers, error normalization | `src/shared/api/client.ts` |
| Query client + provider, devtools in dev | `src/shared/lib/queryClient.ts` |
| App layout providers | `src/app/layout.tsx` |
| Minimal design-system primitives (Button, Card, Banner, Badge, Spinner, Alert) | `src/shared/ui/` |

### Query defaults (named constants)

- Explicit `staleTime` on every query registration.
- `refetchInterval: BALANCE_POLL_INTERVAL_MS` for per-cell balance queries only.
- `refetchIntervalInBackground: false`.
- Retry respects `HCMError.retryable`.

### Acceptance criteria

- [ ] No `fetch()` outside `shared/api/client.ts`.
- [ ] App starts; missing env throws at startup.
- [ ] Service layer tests (Phase 8) can import client + MSW.

---

## Phase 5 — Balances feature (employee view foundation)

**Goal:** Employee sees per-location balances with full display-status matrix and polling/buffer behavior.

**Depends on:** Phases 3–4.

### Implement (order: services → hooks → container → view)

| Layer | Responsibility |
|-------|----------------|
| Services | Implement `balance.service.ts` with Zod parse on every response |
| Hooks | `useBalanceQuery`, `useBalanceBatchHydration`, `useBalanceReconciliation` (buffer + status derivation) |
| Container | `BalanceListContainer` — batch once, per-cell polls, wire statuses |
| View | `BalanceListView`, `BalanceCard` — props only, handles all `BalanceDisplayStatus` |
| Page | `src/app/(employee)/...` — thin shell, passes `employeeId` only |

### UI requirements

- Multiple rows per employee (one card per location).
- `refreshed-mid-session` → non-intrusive inline banner.
- `hcm-silent-conflict` → warning to verify before resubmit.
- `optimistic-rolled-back` visually distinct from `error`.

### Zustand (if any)

- UI only, e.g. expand/collapse location group — **not** balance values.

### Acceptance criteria

- [ ] Container has single child View; View has no `useQuery`/`useMutation`.
- [ ] Polling pauses when tab unfocused.
- [ ] Buffer logic: poll during mutation does not overwrite optimistic display (hook tests in Phase 8).

---

## Phase 6 — Requests feature (employee submit flow)

**Goal:** Submit time-off with optimistic deduction + full mutation contract.

**Depends on:** Phase 5.

### Implement

| Layer | Files |
|-------|-------|
| Services | `request.service.ts` |
| Hooks | `useOptimisticRequest` (or equivalent) — exact pattern `.cursorrules` §8 |
| Utils | `applyOptimisticDeduction`, silent-failure detection on settled |
| Container | `RequestFormContainer` |
| View | `RequestForm` — idle, validating, submitting, success, rolled-back, rejected, silent-conflict |
| Page | Employee route composing balances + form |

### Mutation contract (mandatory)

- `onMutate`: cancel queries, snapshot, optimistic `setQueryData`.
- `onError`: restore snapshot.
- `onSettled`: **invalidate** `BALANCE_KEYS` (broadest correct scope).
- On success + refetch mismatch → `hcm-silent-conflict` / `SILENT_FAILURE`.

### Acceptance criteria

- [ ] Submit never shows final "approved" until reconciliation completes (employee submit = pending/submitted state, not manager approval).
- [ ] `INSUFFICIENT_BALANCE` and `INVALID_DIMENSION` surface as `hcm-rejected`.
- [ ] Employee ID not in URL query params.

---

## Phase 7 — Approvals feature (manager view) + Storybook matrix

**Goal:** Manager approves/denies with fresh balance context; all required stories exist.

**Depends on:** Phases 5–6.

### 7a — Manager feature

| Layer | Responsibility |
|-------|----------------|
| Services | `approval.service.ts` |
| Hooks | Approval mutations with same optimistic/reconcile rules where balance affected |
| Container | `ApprovalQueueContainer` |
| View | `ManagerApprovalCard`, queue list |
| Page | `src/app/(manager)/...` — thin shell |

**Manager-specific:** Show balance at decision time; distinguish `PendingWithFreshBalance` vs `PendingWithStaleBalance`; `ConflictOnApprove`.

### 7b — Storybook (required stories)

Colocated `*.stories.tsx` next to components. **MSW only** for async states. **Every story has a `play` function.**

**BalanceCard:** Loading, Empty, Success, Stale, OptimisticPending, OptimisticRolledBack, HCMRejected, HCMSilentConflict, RefreshedMidSession, Error.

**RequestForm:** Idle, Validating, Submitting, SubmitSuccess, SubmitRolledBack, SubmitHCMRejected, SubmitSilentConflict.

**ManagerApprovalCard:** PendingWithFreshBalance, PendingWithStaleBalance, Approving, Approved, Denied, ConflictOnApprove.

Story title format: `Component/State` (e.g. `BalanceCard/OptimisticRolledBack`).

### Acceptance criteria

- [ ] `npm run storybook` shows full matrix above.
- [ ] No hardcoded async props bypassing MSW.
- [ ] Manager mutations invalidate approvals + affected balances on settle.

---

## Phase 8 — Test suite & coverage proof

**Goal:** Behavioral coverage of failure matrix; future contributors cannot silently break reconciliation.

**Depends on:** Phases 5–7.

### Required tests

| Layer | Tool | Must include |
|-------|------|----------------|
| Pure utils | Vitest | Calculations, `applyOptimisticDeduction`, reconciliation, silent-fail detection |
| Services | Vitest + MSW | Each endpoint; Zod rejection; every `HCMErrorCode` mapping |
| Container hooks | Vitest + RTL | Optimistic rollback; `onSettled` invalidation; buffer flush → `refreshed-mid-session` |
| Components | Storybook `play` | All stories interact at least once |
| E2E | Playwright | (1) Submit → manager approve; (2) Anniversary mid-session; (3) **Silent fail recovery** |

### Rules

- Test observable behavior, not implementation details.
- **Dedicated integration test for silent failure** (highest priority).
- Each test resets MSW + Query cache — no shared mutable state.
- Every `HCMErrorCode` exercised through UI at least once.

### Coverage proof

- [ ] `npm run test` green.
- [ ] `npm run test:e2e` green against `next dev` or `next start`.
- [ ] Document in `docs/TESTING.md`: commands, what each layer guards, coverage report path (e.g. `coverage/lcov-report/index.html`).

### Acceptance criteria

- [ ] CI-ready test scripts.
- [ ] Silent-fail test exists and would fail if reconciliation removed.

---

## Phase 9 — CI, deploy, README, handoff

**Goal:** Grader can clone, install, run app + Storybook + tests in minutes.

**Depends on:** Phase 8.

### Implement

| Item | Detail |
|------|--------|
| GitHub Actions (or equivalent) | `lint`, `test`, `build`, `npm audit` (high severity fails) |
| Storybook deploy | Chromatic **or** Vercel static `build-storybook` — URL in README |
| README | Setup, env vars, scripts, architecture link to TRD, Storybook URL |
| `.env.example` | All vars from `config.ts` |
| Rate limit + CORS | Documented for mock routes |

### Final README checklist for grader

```bash
npm ci
cp .env.example .env.local   # fill values
npm run dev                  # employee + manager routes
npm run storybook            # full UI state matrix
npm run test                 # unit + integration
npm run test:e2e             # e2e (may need playwright install)
```

### Acceptance criteria

- [ ] New machine can follow README without chat context.
- [ ] TRD + PHASES.md + `.cursorrules` linked from README.
- [ ] Optional: Chromatic/Vercel Storybook URL live.

---

## Appendix A — Routes & pages (target)

| Route | Role |
|-------|------|
| `/employee` (or `/`) | Balances + request form |
| `/manager` | Pending approvals queue |
| `/api/hcm/*` | Mock HCM (Phase 3) |

Use route groups `(employee)` and `(manager)` per `.cursorrules`.

---

## Appendix B — `HCMErrorCode` → UX mapping

| Code | Typical UX status |
|------|-------------------|
| `INSUFFICIENT_BALANCE` | `hcm-rejected` |
| `INVALID_DIMENSION` | `hcm-rejected` |
| `CONFLICT` | error / conflict on approve |
| `SILENT_FAILURE` | `hcm-silent-conflict` |
| `TIMEOUT` | `error` (retryable) |
| `NETWORK` | `error` (retryable) |
| `UNKNOWN` | `error` |

---

## Appendix C — Phase ↔ `.cursorrules` map

| .cursorrules § | Phase |
|----------------|-------|
| §2 Folder structure | 1 |
| §3 Container/Presenter | 5–7 |
| §4 Config | 4 |
| §5 Named magic values | 2+ |
| §6 Query keys | 2 |
| §7 State management | 4–7 |
| §8 Optimistic contract | 6–7 |
| §9 Reconciliation states | 2, 5 |
| §10 API layer | 4, 5–7 |
| §11 Zod | 2 |
| §12 Mock endpoints | 3 |
| §13 Storybook | 7 |
| §14 Testing | 8 |
| §15 Security | 3, 4, 9 |
| §16 Polling/buffer | 5 |
| §17 Code generation order | 2 → 3 → 4 → 5 → 6 → 7 → 8 |

---

## Appendix D — What NOT to build

- Real HCM integration (Workday/SAP)
- Production auth system (mock gate is enough)
- Storing balances in Zustand or URL query params
- Raw `fetch` outside shared client
- Skipping `onSettled` invalidation
- Story without `play` for “meaningful” states
- Inline query keys

---

## Quick phase picker (for chat prompts)

| Say this | Agent does |
|----------|------------|
| "Phase 0" | Write `docs/TRD.md` only |
| "Phase 1" | Scaffold project |
| "Phase 2" | Types, schemas, keys, utils, service signatures |
| "Phase 3" | Mock HCM routes + MSW + fixtures |
| "Phase 4" | Config, client, Query provider, UI primitives |
| "Phase 5" | Balances employee UI |
| "Phase 6" | Request submit flow |
| "Phase 7" | Manager approvals + all Storybook stories |
| "Phase 8" | Full test suite + `docs/TESTING.md` |
| "Phase 9" | CI, README, deploy Storybook |
| "Phases 2–3" | Allowed range; update tracker when done |

**End of PHASES.md**
