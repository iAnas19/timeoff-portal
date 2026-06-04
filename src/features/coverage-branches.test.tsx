import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { RequestFormView } from "@/features/requests/RequestForm";
import { useBalances } from "@/features/balances/useBalances";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";
import {
  BALANCE_DISPLAY_STATUS,
  REQUEST_FORM_STATUS,
} from "@/shared/hcm/constants";
import { BALANCE_KEYS } from "@/shared/hcm/queryKeys";
import type { BalanceCell } from "@/shared/hcm/schemas";

const ALICE = SEED_IDS.employee.alice;
const NYC_ID = SEED_IDS.location.nyc;

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

describe("useBalances error branch", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("renders an ERROR card when a cell query fails after the batch hydrates", async () => {
    const { queryClient, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBalances(ALICE), {
      wrapper: Wrapper,
    });

    // The batch hydrates `locations` (seeded cells) and the cell queries settle
    // to SUCCESS from their initialData.
    await waitFor(() =>
      expect(
        result.current.cards.find((card) => card.locationId === NYC_ID)
          ?.status,
      ).toBe(BALANCE_DISPLAY_STATUS.SUCCESS),
    );

    // Now make the per-cell route fail and force a refetch: with retry:false the
    // cell query flips to its error state, driving that card to ERROR.
    hcmServer.use(
      http.get("*/api/hcm/balances/:employeeId/:locationId", () =>
        HttpResponse.json({ message: "Cell unavailable" }, { status: 500 }),
      ),
    );
    await queryClient.invalidateQueries({
      queryKey: BALANCE_KEYS.byEmployeeAndLocation(ALICE, NYC_ID),
    });

    await waitFor(() =>
      expect(
        result.current.cards.find((card) => card.locationId === NYC_ID)
          ?.status,
      ).toBe(BALANCE_DISPLAY_STATUS.ERROR),
    );

    const errored = result.current.cards.find(
      (card) => card.locationId === NYC_ID,
    );
    expect(errored?.availableBalance).toBe(0);
    expect(errored?.message).toBeTruthy();
  });
});

const NYC_CELL: BalanceCell = {
  employeeId: "emp-001",
  locationId: "loc-nyc",
  locationName: "New York",
  confirmedBalance: 10,
  pendingDeductions: 2, // available 8
  asOf: "2026-06-04T00:00:00.000Z",
};

function setup(overrides: Partial<Parameters<typeof RequestFormView>[0]> = {}) {
  const onSubmit = vi.fn();
  const onReset = vi.fn();
  render(
    <RequestFormView
      locations={[NYC_CELL]}
      formStatus={REQUEST_FORM_STATUS.IDLE}
      maxDays={365}
      isSubmitting={false}
      onSubmit={onSubmit}
      onReset={onReset}
      {...overrides}
    />,
  );
  return { onSubmit, onReset };
}

function dateInput(label: RegExp) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe("RequestFormView remaining branches", () => {
  it("shows the 'left after this' summary line for a valid in-budget range", () => {
    setup();
    fireEvent.change(dateInput(/first day off/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(dateInput(/last day off/i), {
      target: { value: "2026-08-03" }, // 3 days of 8 available -> 5 left
    });

    const summary = screen.getByText(/requesting/i);
    expect(summary).toHaveTextContent("3");
    expect(summary).toHaveTextContent(/5 left after this/i);
  });

  it("rejects a range longer than maxDays with the per-request cap message", () => {
    // A ~2-year span blows past the 365-day cap before the balance check runs.
    setup({ maxDays: 365 });
    fireEvent.change(dateInput(/first day off/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(dateInput(/last day off/i), {
      target: { value: "2028-08-01" },
    });

    expect(
      screen.getByText(/can.t exceed 365 days/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeDisabled();
  });

  it("renders the submitting status with a spinner and disables inputs", () => {
    setup({
      formStatus: REQUEST_FORM_STATUS.SUBMITTING,
      isSubmitting: true,
    });

    const status = screen.getByText(/submitting/i);
    expect(status).toBeInTheDocument();
    // Spinner exposes role="status".
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Busy state disables every editable control.
    expect(dateInput(/first day off/i)).toBeDisabled();
    expect(dateInput(/last day off/i)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeDisabled();
    // While busy the validation line is suppressed in favour of the status row.
    expect(screen.queryByText(/can.t exceed/i)).not.toBeInTheDocument();
  });
});
