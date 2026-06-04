import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import EmployeeBalancesContainer from "@/features/balances/EmployeeBalances";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";

const ALICE = SEED_IDS.employee.alice;

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

function renderContainer(employeeId: string) {
  const { Wrapper } = makeWrapper();
  return render(<EmployeeBalancesContainer employeeId={employeeId} />, {
    wrapper: Wrapper,
  });
}

function availableValueOf(card: HTMLElement): string | null {
  return card.querySelector(".balance-available-value")?.textContent ?? null;
}

describe("EmployeeBalancesContainer", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("shows a loading state before the employee balances resolve", () => {
    renderContainer(ALICE);
    expect(screen.getByText("Loading balances…")).toBeInTheDocument();
  });

  it("renders one card per seeded location with its available number", async () => {
    renderContainer(ALICE);

    // New York: confirmed 10 - pending 2 = 8 available.
    const nyc = await screen.findByText("New York");
    const nycCard = nyc.closest(".balance-card") as HTMLElement;
    expect(nycCard).not.toBeNull();
    expect(availableValueOf(nycCard)).toBe("8");

    // Remote: confirmed 5 - pending 0 = 5 available (also Granted 5, so scope to
    // the headline available-value rather than the meta list).
    const remote = await screen.findByText("Remote");
    const remoteCard = remote.closest(".balance-card") as HTMLElement;
    expect(remoteCard).not.toBeNull();
    expect(availableValueOf(remoteCard)).toBe("5");

    // Both settle to the "Current" success badge (statusLabel/badgeTone success).
    await waitFor(() =>
      expect(screen.getAllByText("Current")).toHaveLength(2),
    );
  });

  it("renders the demo panel with all four scenario buttons", async () => {
    renderContainer(ALICE);

    await screen.findByText("New York");

    expect(
      screen.getByRole("button", { name: /anniversary bonus/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /arm silent fail/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /arm conflict/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /arm slow/i }),
    ).toBeInTheDocument();
  });

  it("surfaces the HCM-updated banner after an anniversary bonus and clears it on dismiss", async () => {
    const user = userEvent.setup();
    renderContainer(ALICE);

    // Let the cells settle to success first so the baseline confirmed balance is
    // recorded; only then can a later refetch be detected as an external change.
    await waitFor(() =>
      expect(screen.getAllByText("Current")).toHaveLength(2),
    );

    await user.click(
      screen.getByRole("button", { name: /anniversary bonus/i }),
    );

    // The invalidation/refetch picks up the bumped confirmed balance and surfaces
    // the refreshed-mid-session banner. The bonus applies to every location, so a
    // banner appears on each card; dismiss the New York one specifically.
    await screen.findAllByText(/balance updated by hcm/i);

    const nycCard = screen.getByText("New York").closest(
      ".balance-card",
    ) as HTMLElement;
    expect(nycCard).not.toBeNull();

    const nycBanner = within(nycCard).getByText(/balance updated by hcm/i);
    expect(nycBanner).toBeInTheDocument();

    await user.click(
      within(nycCard).getByRole("button", { name: /dismiss/i }),
    );

    await waitFor(() =>
      expect(
        within(nycCard).queryByText(/balance updated by hcm/i),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the empty state when the employee has no balance rows", async () => {
    renderContainer("emp-zzz");

    expect(
      await screen.findByText("No balance locations found."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading balances…")).not.toBeInTheDocument();
    // No demo panel when there are no cards to act on.
    expect(
      screen.queryByRole("button", { name: /anniversary bonus/i }),
    ).not.toBeInTheDocument();
  });
});
