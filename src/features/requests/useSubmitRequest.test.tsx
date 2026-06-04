import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { useBalances } from "@/features/balances/useBalances";
import type { BalanceCardState } from "@/features/balances/useBalances";
import { useSubmitRequest } from "@/features/requests/useSubmitRequest";
import { hcmServer } from "@/mocks/server";
import { armConflict, armSilentFail, resetStore } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";
import {
  BALANCE_DISPLAY_STATUS,
  REQUEST_FORM_STATUS,
} from "@/shared/hcm/constants";

const ALICE = SEED_IDS.employee.alice;
const NYC = SEED_IDS.location.nyc;
const VALID_REQUEST = {
  locationId: NYC,
  days: 1,
  startDate: "2026-08-01",
  endDate: "2026-08-01",
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { Wrapper };
}

// Both hooks share a cache the way the employee page mounts them - useBalances
// populates the per-cell key that useSubmitRequest snapshots for reconciliation.
function renderEmployeePage() {
  const { Wrapper } = makeWrapper();
  return renderHook(
    () => ({ balances: useBalances(ALICE), submit: useSubmitRequest(ALICE) }),
    { wrapper: Wrapper },
  );
}

function nycCard(result: {
  current: { balances: { cards: BalanceCardState[] } };
}): BalanceCardState | undefined {
  return result.current.balances.cards.find((card) => card.locationId === NYC);
}

describe("useSubmitRequest", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("reconciles a successful submit and reflects the new pending deduction", async () => {
    const { result } = renderEmployeePage();

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    act(() => result.current.submit.submit(VALID_REQUEST));

    await waitFor(() =>
      expect(result.current.submit.formStatus).toBe(
        REQUEST_FORM_STATUS.SUBMIT_SUCCESS,
      ),
    );

    await waitFor(() =>
      // seed pending 2 + 1 requested = 3
      expect(nycCard(result)?.pendingDeductions).toBe(3),
    );
  });

  it("detects a silent failure: HCM returns 200 but the balance never changed", async () => {
    const { result } = renderEmployeePage();

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    armSilentFail(); // next write returns 200 without persisting

    act(() => result.current.submit.submit(VALID_REQUEST));

    await waitFor(() =>
      expect(result.current.submit.formStatus).toBe(
        REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT,
      ),
    );

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(
        BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT,
      ),
    );
  });

  it("surfaces an explicit HCM rejection as hcm-rejected (insufficient balance)", async () => {
    const { result } = renderEmployeePage();

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    act(() =>
      result.current.submit.submit({ ...VALID_REQUEST, days: 99 }),
    );

    await waitFor(() =>
      expect(result.current.submit.formStatus).toBe(
        REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED,
      ),
    );

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(
        BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK,
      ),
    );
  });

  it("rolls back (with the reason) when HCM returns a write conflict", async () => {
    const { result } = renderEmployeePage();

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    armConflict(); // next write returns 409

    act(() => result.current.submit.submit(VALID_REQUEST));

    await waitFor(() =>
      expect(result.current.submit.formStatus).toBe(
        REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK,
      ),
    );
    expect(result.current.submit.statusMessage).toMatch(/conflict|retry/i);
    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(
        BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK,
      ),
    );
  });

  it("rolls back a duplicate/overlapping request with a clear message", async () => {
    // Seed has a pending Alice/NYC request for 2026-07-01..02.
    const { result } = renderEmployeePage();

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    act(() =>
      result.current.submit.submit({
        locationId: NYC,
        days: 2,
        startDate: "2026-07-02",
        endDate: "2026-07-03",
      }),
    );

    await waitFor(() =>
      expect(result.current.submit.formStatus).toBe(
        REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK,
      ),
    );
    expect(result.current.submit.statusMessage).toMatch(/already covers/i);
  });

  it("rejects invalid client input before any network call", async () => {
    const { result } = renderEmployeePage();

    await waitFor(() =>
      expect(nycCard(result)?.status).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    act(() => result.current.submit.submit({ ...VALID_REQUEST, days: 0 }));

    await waitFor(() =>
      expect(result.current.submit.formStatus).toBe(REQUEST_FORM_STATUS.IDLE),
    );
    expect(result.current.submit.statusMessage).toBeTruthy();
  });
});
