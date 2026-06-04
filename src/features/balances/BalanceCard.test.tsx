import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BalanceCard } from "@/features/balances/EmployeeBalances";
import { BALANCE_DISPLAY_STATUS } from "@/shared/hcm/constants";

const base = {
  locationId: "loc-nyc",
  locationName: "New York",
  availableBalance: 8,
  confirmedBalance: 10,
  pendingDeductions: 2,
};

describe("BalanceCard", () => {
  it("shows the available number and a Current badge on success", () => {
    render(<BalanceCard {...base} status={BALANCE_DISPLAY_STATUS.SUCCESS} />);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("New York")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("renders a spinner and loading text in the loading state", () => {
    render(
      <BalanceCard
        {...base}
        availableBalance={0}
        status={BALANCE_DISPLAY_STATUS.LOADING}
      />,
    );
    expect(screen.getByText(/loading balance/i)).toBeInTheDocument();
  });

  it("renders the error message in an alert", () => {
    render(
      <BalanceCard
        {...base}
        status={BALANCE_DISPLAY_STATUS.ERROR}
        message="HCM request timed out"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("HCM request timed out");
  });

  it("shows a dismissable banner for a rolled-back overlay", async () => {
    const onDismissOverlay = vi.fn();
    render(
      <BalanceCard
        {...base}
        status={BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK}
        message="Your request did not apply. Balance restored."
        onDismissOverlay={onDismissOverlay}
      />,
    );
    expect(screen.getByText(/did not apply/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismissOverlay).toHaveBeenCalledOnce();
  });

  it("labels an explicit rejection distinctly from an error", () => {
    render(
      <BalanceCard
        {...base}
        status={BALANCE_DISPLAY_STATUS.HCM_REJECTED}
        message="Insufficient balance."
      />,
    );
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("shows a quiet refreshing hint without changing the status on success", () => {
    render(
      <BalanceCard
        {...base}
        status={BALANCE_DISPLAY_STATUS.SUCCESS}
        isRefreshing
      />,
    );
    expect(screen.getByText(/updating/i)).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });
});
