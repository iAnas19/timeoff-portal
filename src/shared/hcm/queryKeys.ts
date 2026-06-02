export const BALANCE_KEYS = {
  all: ["balances"] as const,
  byEmployee: (employeeId: string) =>
    [...BALANCE_KEYS.all, employeeId] as const,
  byEmployeeAndLocation: (employeeId: string, locationId: string) =>
    [...BALANCE_KEYS.byEmployee(employeeId), locationId] as const,
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
