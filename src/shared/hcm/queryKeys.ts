import { BALANCE_DISPLAY_STATUS } from "@/shared/hcm/constants";

export const BALANCE_KEYS = {
  all: ["balances"] as const,
  byEmployee: (employeeId: string) =>
    [...BALANCE_KEYS.all, employeeId] as const,
  byEmployeeAndLocation: (employeeId: string, locationId: string) =>
    [...BALANCE_KEYS.byEmployee(employeeId), locationId] as const,
  // Overlays live OUTSIDE the "balances" tree on purpose: invalidating a balance
  // key must never wipe a rolled-back / silent-conflict / refreshed banner.
  overlay: (employeeId: string, locationId: string) =>
    ["balance-overlay", employeeId, locationId] as const,
};

export const REQUEST_KEYS = {
  all: ["requests"] as const,
  byEmployee: (employeeId: string) =>
    [...REQUEST_KEYS.all, employeeId] as const,
  byId: (requestId: string) =>
    [...REQUEST_KEYS.all, "detail", requestId] as const,
};

export const APPROVAL_KEYS = {
  all: ["approvals"] as const,
  pending: () => [...APPROVAL_KEYS.all, "pending"] as const,
  byManager: (managerId: string) =>
    [...APPROVAL_KEYS.all, "manager", managerId] as const,
};

export const MUTATION_KEYS = {
  submitRequest: [...REQUEST_KEYS.all, "submit"] as const,
  approveRequest: [...APPROVAL_KEYS.all, "approve"] as const,
  denyRequest: [...APPROVAL_KEYS.all, "deny"] as const,
};

export type BalanceCardOverlay = {
  status:
    | BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK
    | BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT
    | BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION;
  message: string;
};
