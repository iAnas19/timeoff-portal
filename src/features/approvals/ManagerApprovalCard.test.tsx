import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ManagerApprovalCard } from "@/features/approvals/ManagerApprovals";
import { APPROVAL_CARD_STATUS, REQUEST_STATUS } from "@/shared/hcm/constants";
import type { PendingApproval } from "@/shared/hcm/schemas";

const approval: PendingApproval = {
  request: {
    id: "req-001",
    employeeId: "emp-001",
    locationId: "loc-nyc",
    days: 2,
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    status: REQUEST_STATUS.PENDING,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
  },
  employeeDisplayName: "Alice Chen",
  locationName: "New York",
  balanceAtQueueTime: {
    employeeId: "emp-001",
    locationId: "loc-nyc",
    locationName: "New York",
    confirmedBalance: 10,
    pendingDeductions: 2,
    asOf: "2026-06-04T00:00:00.000Z",
  },
  balanceFreshness: "fresh" as PendingApproval["balanceFreshness"],
};

function setup(
  status: Parameters<typeof ManagerApprovalCard>[0]["status"],
  extra: Partial<Parameters<typeof ManagerApprovalCard>[0]> = {},
) {
  const onApprove = vi.fn();
  const onDeny = vi.fn();
  render(
    <ManagerApprovalCard
      approval={approval}
      status={status}
      liveAvailableBalance={8}
      onApprove={onApprove}
      onDeny={onDeny}
      {...extra}
    />,
  );
  return { onApprove, onDeny };
}

describe("ManagerApprovalCard", () => {
  it("shows the employee, both balance contexts, and a fresh badge", () => {
    setup(APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE);
    expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    expect(screen.getByText("Fresh balance")).toBeInTheDocument();
    expect(screen.getByText(/at queue time/i)).toBeInTheDocument();
    expect(screen.getByText(/live balance/i)).toBeInTheDocument();
  });

  it("warns when the live balance is stale vs queue time", () => {
    setup(APPROVAL_CARD_STATUS.PENDING_STALE_BALANCE, {
      message: "Live balance differs from when this was queued.",
    });
    expect(screen.getByText("Stale balance")).toBeInTheDocument();
    expect(screen.getByText(/differs from when this was queued/i)).toBeInTheDocument();
  });

  it("fires approve/deny callbacks", async () => {
    const { onApprove, onDeny } = setup(
      APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE,
    );
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    await userEvent.click(screen.getByRole("button", { name: /deny/i }));
    expect(onApprove).toHaveBeenCalledWith("req-001");
    expect(onDeny).toHaveBeenCalledWith("req-001");
  });

  it("disables actions and shows the result once approved", () => {
    setup(APPROVAL_CARD_STATUS.APPROVED);
    expect(document.querySelector(".approval-result-success")).toHaveTextContent(
      "Approved",
    );
    expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
  });

  it("surfaces a conflict-on-approve message", () => {
    setup(APPROVAL_CARD_STATUS.CONFLICT_ON_APPROVE, {
      message: "Write conflict - retry later",
    });
    expect(screen.getByText(/retry later/i)).toBeInTheDocument();
  });

  it("shows the processing label while approving", () => {
    setup(APPROVAL_CARD_STATUS.APPROVING, { message: "Approving…" });
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve/i })).toBeDisabled();
  });

  it("shows the denied result", () => {
    setup(APPROVAL_CARD_STATUS.DENIED);
    expect(document.querySelector(".approval-result-denied")).toHaveTextContent(
      "Denied",
    );
  });
});
