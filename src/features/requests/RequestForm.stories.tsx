import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import { RequestFormView } from "@/features/requests/RequestForm";
import { REQUEST_FORM_STATUS } from "@/shared/hcm/constants";

const locations = [
  {
    employeeId: "emp-001",
    locationId: "loc-nyc",
    locationName: "New York",
    confirmedBalance: 10,
    pendingDeductions: 2,
    asOf: new Date().toISOString(),
  },
  {
    employeeId: "emp-001",
    locationId: "loc-remote",
    locationName: "Remote",
    confirmedBalance: 5,
    pendingDeductions: 0,
    asOf: new Date().toISOString(),
  },
];

const meta = {
  title: "RequestForm",
  component: RequestFormView,
  args: {
    locations,
    formStatus: REQUEST_FORM_STATUS.IDLE,
    minDays: 0.5,
    maxDays: 365,
    isSubmitting: false,
    onSubmit: () => undefined,
    onReset: () => undefined,
  },
} satisfies Meta<typeof RequestFormView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  name: "RequestForm/Idle",
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("button", { name: /submit request/i }),
    ).toBeEnabled();
  },
};

export const Validating: Story = {
  name: "RequestForm/Validating",
  args: { formStatus: REQUEST_FORM_STATUS.VALIDATING },
};

export const Submitting: Story = {
  name: "RequestForm/Submitting",
  args: {
    formStatus: REQUEST_FORM_STATUS.SUBMITTING,
    isSubmitting: true,
  },
};

export const SubmitSuccess: Story = {
  name: "RequestForm/SubmitSuccess",
  args: {
    formStatus: REQUEST_FORM_STATUS.SUBMIT_SUCCESS,
    statusMessage: "Request submitted and balance reconciled.",
  },
};

export const SubmitRolledBack: Story = {
  name: "RequestForm/SubmitRolledBack",
  args: {
    formStatus: REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK,
    statusMessage: "Request failed. Balance restored.",
  },
};

export const SubmitHCMRejected: Story = {
  name: "RequestForm/SubmitHCMRejected",
  args: {
    formStatus: REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED,
    statusMessage: "Insufficient balance for this request.",
  },
};

export const SubmitSilentConflict: Story = {
  name: "RequestForm/SubmitSilentConflict",
  args: {
    formStatus: REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT,
    statusMessage: "Verify before resubmitting.",
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /new request/i }),
    );
  },
};
