import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
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
import { hcmServer } from "@/mocks/server";
import { resetStore, simulateAnniversary } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";
import { BALANCE_DISPLAY_STATUS } from "@/shared/hcm/constants";
import { BALANCE_KEYS } from "@/shared/hcm/queryKeys";

const ALICE = SEED_IDS.employee.alice;
const NYC = SEED_IDS.location.nyc;

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

describe("useBalances reconciliation", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("hydrates one card per location with a success status", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBalances(ALICE), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.cards).toHaveLength(2));
    await waitFor(() =>
      expect(
        result.current.cards.every(
          (card) => card.status === BALANCE_DISPLAY_STATUS.SUCCESS,
        ),
      ).toBe(true),
    );

    const nyc = result.current.cards.find((card) => card.locationId === NYC);
    expect(nyc?.availableBalance).toBe(8); // confirmed 10 - pending 2
  });

  it("surfaces refreshed-mid-session when HCM changes a balance underneath the user", async () => {
    const { queryClient, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBalances(ALICE), { wrapper: Wrapper });

    // Establish the baseline: cards must settle to success first.
    await waitFor(() =>
      expect(
        result.current.cards.find((card) => card.locationId === NYC)?.status,
      ).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    // HCM grants an anniversary bonus server-side, then the poll picks it up.
    simulateAnniversary(ALICE);
    await queryClient.invalidateQueries({
      queryKey: BALANCE_KEYS.byEmployee(ALICE),
    });

    await waitFor(() =>
      expect(
        result.current.cards.find((card) => card.locationId === NYC)?.status,
      ).toBe(BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION),
    );

    const nyc = result.current.cards.find((card) => card.locationId === NYC);
    expect(nyc?.confirmedBalance).toBe(11); // 10 + 1 anniversary day
    expect(nyc?.message).toMatch(/HCM/i);
  });

  it("clears the refreshed-mid-session overlay on dismiss", async () => {
    const { queryClient, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBalances(ALICE), { wrapper: Wrapper });

    await waitFor(() =>
      expect(
        result.current.cards.find((card) => card.locationId === NYC)?.status,
      ).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    simulateAnniversary(ALICE);
    await queryClient.invalidateQueries({
      queryKey: BALANCE_KEYS.byEmployee(ALICE),
    });
    await waitFor(() =>
      expect(
        result.current.cards.find((card) => card.locationId === NYC)?.status,
      ).toBe(BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION),
    );

    result.current.clearOverlay(NYC);

    await waitFor(() =>
      expect(
        result.current.cards.find((card) => card.locationId === NYC)?.status,
      ).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );
  });
});
