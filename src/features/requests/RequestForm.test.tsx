import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestFormView } from "@/features/requests/RequestForm";
import { REQUEST_FORM_STATUS } from "@/shared/hcm/constants";
import type { BalanceCell } from "@/shared/hcm/schemas";

const NYC: BalanceCell = {
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
      locations={[NYC]}
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

describe("RequestFormView", () => {
  it("derives the requested days from the date range and submits them", () => {
    const { onSubmit } = setup();
    fireEvent.change(dateInput(/first day off/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(dateInput(/last day off/i), {
      target: { value: "2026-08-03" },
    });
    expect(screen.getByText(/requesting/i)).toHaveTextContent("3");
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: "loc-nyc", days: 3 }),
    );
  });

  it("blocks a past start date with an inline message", () => {
    const { onSubmit } = setup();
    fireEvent.change(dateInput(/first day off/i), {
      target: { value: "2000-01-01" },
    });
    expect(screen.getByText(/can.t be in the past/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks a request that exceeds the available balance", () => {
    setup();
    fireEvent.change(dateInput(/last day off/i), {
      target: { value: "2026-09-01" }, // ~32 days vs 8 available
    });
    expect(screen.getByText(/only 8 days available/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeDisabled();
  });

  it("disables an exhausted location option and shows the empty state when all are exhausted", () => {
    setup({
      locations: [{ ...NYC, pendingDeductions: NYC.confirmedBalance }],
    });
    expect(screen.getByText(/fully booked/i)).toBeInTheDocument();
  });
});
