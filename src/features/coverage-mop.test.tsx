import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
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
import EmployeeBalancesContainer, {
  BalanceCard,
} from "@/features/balances/EmployeeBalances";
import RequestFormContainer from "@/features/requests/RequestForm";
import { useSubmitRequest } from "@/features/requests/useSubmitRequest";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";
import {
  BALANCE_DISPLAY_STATUS,
  REQUEST_FORM_STATUS,
} from "@/shared/hcm/constants";

const ALICE = SEED_IDS.employee.alice;
const NYC = SEED_IDS.location.nyc;

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

const baseCard = {
  locationId: NYC,
  locationName: "New York",
  availableBalance: 8,
  confirmedBalance: 10,
  pendingDeductions: 2,
};

describe("BalanceCard status labels", () => {
  it.each([
    [BALANCE_DISPLAY_STATUS.STALE, "Stale"],
    [BALANCE_DISPLAY_STATUS.OPTIMISTIC_PENDING, "Pending"],
    [BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT, "Not applied"],
    [BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION, "Updated"],
    [BALANCE_DISPLAY_STATUS.IDLE, "Idle"],
  ])("renders the %s badge", (status, label) => {
    render(<BalanceCard {...baseCard} status={status} message="note" />);
    // "Pending" also appears as a meta label, so allow >=1 match.
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });
});

describe("useSubmitRequest validation + reset", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("rejects a request over the max-days limit", async () => {
    const { result } = renderHook(() => useSubmitRequest(ALICE), {
      wrapper: wrapper(),
    });
    act(() =>
      result.current.submit({
        locationId: NYC,
        days: 400,
        startDate: "2026-08-01",
        endDate: "2027-09-04",
      }),
    );
    await waitFor(() =>
      expect(result.current.formStatus).toBe(REQUEST_FORM_STATUS.IDLE),
    );
    expect(result.current.statusMessage).toMatch(/between/i);
  });

  it("resetForm returns the form to idle", async () => {
    const { result } = renderHook(() => useSubmitRequest(ALICE), {
      wrapper: wrapper(),
    });
    act(() => result.current.resetForm());
    await waitFor(() =>
      expect(result.current.formStatus).toBe(REQUEST_FORM_STATUS.IDLE),
    );
    expect(result.current.statusMessage).toBeUndefined();
  });

  it("rolls back with a network message when the HR system is unreachable", async () => {
    hcmServer.use(
      http.post("*/api/hcm/requests", () => HttpResponse.error()),
    );
    const { result } = renderHook(() => useSubmitRequest(ALICE), {
      wrapper: wrapper(),
    });
    act(() =>
      result.current.submit({
        locationId: NYC,
        days: 1,
        startDate: "2026-08-01",
        endDate: "2026-08-01",
      }),
    );
    await waitFor(() =>
      expect(result.current.formStatus).toBe(
        REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK,
      ),
    );
    expect(result.current.statusMessage).toMatch(/couldn't reach/i);
  });

  it("rolls back with a timeout message when the HR system is too slow", async () => {
    hcmServer.use(
      http.post("*/api/hcm/requests", async () => {
        await delay(3000); // exceeds the 2s client timeout
        return HttpResponse.json({});
      }),
    );
    const { result } = renderHook(() => useSubmitRequest(ALICE), {
      wrapper: wrapper(),
    });
    act(() =>
      result.current.submit({
        locationId: NYC,
        days: 1,
        startDate: "2026-08-01",
        endDate: "2026-08-01",
      }),
    );
    await waitFor(
      () =>
        expect(result.current.formStatus).toBe(
          REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK,
        ),
      { timeout: 4000 },
    );
    expect(result.current.statusMessage).toMatch(/in time/i);
  });
});

describe("EmployeeBalances demo arms", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("arms silent-fail and conflict from the demo panel", async () => {
    render(<EmployeeBalancesContainer employeeId={ALICE} />, {
      wrapper: wrapper(),
    });
    await screen.findByText("New York");

    // These arm flags only affect the next *write*; the post-click refetch is a
    // GET, so it stays fast (no slow delay involved).
    const silent = screen.getByRole("button", { name: /arm silent fail/i });
    await userEvent.click(silent);
    await waitFor(() => expect(silent).toBeEnabled());

    const conflict = screen.getByRole("button", { name: /arm conflict/i });
    await userEvent.click(conflict);
    await waitFor(() => expect(conflict).toBeEnabled());
  });

  it("renders the RequestForm container wired to the hook and changes location", async () => {
    render(<RequestFormContainer employeeId={ALICE} />, { wrapper: wrapper() });
    const select = (await screen.findByLabelText(/location/i)) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
    await userEvent.selectOptions(select, SEED_IDS.location.remote);
    expect(select.value).toBe(SEED_IDS.location.remote);
  });
});
