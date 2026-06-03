import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { ManagerApprovalCard } from "@/features/approvals/ManagerApprovals";
import { APPROVAL_CARD_STATUS, BALANCE_FRESHNESS, REQUEST_STATUS } from "@/shared/hcm/constants";

const timestamp = new Date().toISOString();

const baseApproval = {
  request: {
    id: "req-001",
    employeeId: "emp-001",
    locationId: "loc-nyc",
    days: 2,
    startDate: "2026-07-01",
    endDate: "2026-07-02",
    status: REQUEST_STATUS.PENDING,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  employeeDisplayName: "Alice Chen",
  locationName: "New York",
  balanceAtQueueTime: {
    employeeId: "emp-001",
    locationId: "loc-nyc",
    locationName: "New York",
    confirmedBalance: 10,
    pendingDeductions: 2,
    asOf: timestamp,
  },
  balanceFreshness: BALANCE_FRESHNESS.FRESH,
};

const meta = {
  title: "ManagerApprovalCard",
  component: ManagerApprovalCard,
  args: {
    approval: baseApproval,
    status: APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE,
    liveAvailableBalance: 8,
    onApprove: () => undefined,
    onDeny: () => undefined,
  },
} satisfies Meta<typeof ManagerApprovalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PendingWithFreshBalance: Story = {
  name: "ManagerApprovalCard/PendingWithFreshBalance",
};

export const PendingWithStaleBalance: Story = {
  name: "ManagerApprovalCard/PendingWithStaleBalance",
  args: {
    status: APPROVAL_CARD_STATUS.PENDING_STALE_BALANCE,
    liveAvailableBalance: 6,
    message: "Live balance differs from when this was queued.",
  },
};

export const Approving: Story = {
  name: "ManagerApprovalCard/Approving",
  args: {
    status: APPROVAL_CARD_STATUS.APPROVING,
    message: "Approving…",
  },
};

export const Approved: Story = {
  name: "ManagerApprovalCard/Approved",
  args: {
    status: APPROVAL_CARD_STATUS.APPROVED,
  },
};

export const Denied: Story = {
  name: "ManagerApprovalCard/Denied",
  args: {
    status: APPROVAL_CARD_STATUS.DENIED,
  },
};

export const ConflictOnApprove: Story = {
  name: "ManagerApprovalCard/ConflictOnApprove",
  args: {
    status: APPROVAL_CARD_STATUS.CONFLICT_ON_APPROVE,
    message: "Write conflict — retry later",
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/conflict/i),
    ).toBeInTheDocument();
  },
};
