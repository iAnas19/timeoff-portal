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
import { useApprovals } from "@/features/approvals/useApprovals";
import { hcmServer } from "@/mocks/server";
import { armConflict, resetStore, simulateAnniversary } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";
import { APPROVAL_CARD_STATUS } from "@/shared/hcm/constants";
import { BALANCE_KEYS } from "@/shared/hcm/queryKeys";

const ALICE = SEED_IDS.employee.alice;
const NYC = SEED_IDS.location.nyc;
const PENDING_REQUEST = SEED_IDS.request.pending;

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

describe("useApprovals", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("shows the queued request as pending-with-fresh-balance on load", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApprovals(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.cards[0]?.status).toBe(
        APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE,
      ),
    );
  });

  it("flags pending-with-stale-balance when HCM moves the balance after queueing", async () => {
    const { queryClient, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApprovals(), { wrapper: Wrapper });

    await waitFor(() =>
      expect(result.current.cards[0]?.status).toBe(
        APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE,
      ),
    );

    // Balance changes underneath the queue; only the live cell refetches.
    simulateAnniversary(ALICE);
    await queryClient.invalidateQueries({
      queryKey: BALANCE_KEYS.byEmployeeAndLocation(ALICE, NYC),
    });

    await waitFor(() =>
      expect(result.current.cards[0]?.status).toBe(
        APPROVAL_CARD_STATUS.PENDING_STALE_BALANCE,
      ),
    );
  });

  it("removes the request from the queue after a successful approval", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApprovals(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.cards).toHaveLength(1));

    act(() => result.current.approve(PENDING_REQUEST));

    await waitFor(() => expect(result.current.cards).toHaveLength(0));
  });

  it("surfaces conflict-on-approve when HCM returns 409", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useApprovals(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.cards).toHaveLength(1));

    armConflict(); // next write returns 409 CONFLICT

    act(() => result.current.approve(PENDING_REQUEST));

    await waitFor(() =>
      expect(result.current.cards[0]?.status).toBe(
        APPROVAL_CARD_STATUS.CONFLICT_ON_APPROVE,
      ),
    );
  });
});
