import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { BalanceCard } from "@/features/balances/EmployeeBalances";
import { BALANCE_DISPLAY_STATUS } from "@/shared/hcm/constants";

const baseCard = {
  locationId: "loc-nyc",
  locationName: "New York",
  availableBalance: 8,
  confirmedBalance: 10,
  pendingDeductions: 2,
};

const meta = {
  title: "BalanceCard",
  component: BalanceCard,
  args: {
    ...baseCard,
    status: BALANCE_DISPLAY_STATUS.SUCCESS,
  },
} satisfies Meta<typeof BalanceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  name: "BalanceCard/Loading",
  args: {
    ...baseCard,
    status: BALANCE_DISPLAY_STATUS.LOADING,
    availableBalance: 0,
    confirmedBalance: 0,
    pendingDeductions: 0,
  },
};

export const Empty: Story = {
  name: "BalanceCard/Empty",
  args: {
    ...baseCard,
    status: BALANCE_DISPLAY_STATUS.IDLE,
    availableBalance: 0,
    confirmedBalance: 0,
    pendingDeductions: 0,
    message: "No balance on file for this location.",
  },
};

export const Success: Story = {
  name: "BalanceCard/Success",
  args: {
    status: BALANCE_DISPLAY_STATUS.SUCCESS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("8")).toBeInTheDocument();
  },
};

export const Stale: Story = {
  name: "BalanceCard/Stale",
  args: {
    status: BALANCE_DISPLAY_STATUS.STALE,
    message: "Balance may be outdated.",
  },
};

export const OptimisticPending: Story = {
  name: "BalanceCard/OptimisticPending",
  args: {
    status: BALANCE_DISPLAY_STATUS.OPTIMISTIC_PENDING,
    availableBalance: 6,
    pendingDeductions: 4,
    message: "Pending your request…",
  },
};

export const OptimisticRolledBack: Story = {
  name: "BalanceCard/OptimisticRolledBack",
  args: {
    status: BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK,
    message: "Your last action did not apply. Balance restored.",
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(/did not apply/i),
    ).toBeInTheDocument();
  },
};

export const HCMRejected: Story = {
  name: "BalanceCard/HCMRejected",
  args: {
    status: BALANCE_DISPLAY_STATUS.HCM_REJECTED,
    message: "Insufficient balance for this request.",
  },
};

export const HCMSilentConflict: Story = {
  name: "BalanceCard/HCMSilentConflict",
  args: {
    status: BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT,
    message: "Verify before resubmitting.",
  },
};

export const RefreshedMidSession: Story = {
  name: "BalanceCard/RefreshedMidSession",
  args: {
    status: BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION,
    confirmedBalance: 11,
    availableBalance: 9,
    message: "Balance updated while your request was processing.",
    onDismissOverlay: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /dismiss/i }));
  },
};

export const Error: Story = {
  name: "BalanceCard/Error",
  args: {
    status: BALANCE_DISPLAY_STATUS.ERROR,
    message: "HCM request timed out",
    availableBalance: 0,
    confirmedBalance: 0,
    pendingDeductions: 0,
  },
};
