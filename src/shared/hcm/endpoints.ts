const HCM_BASE = "/api/hcm";

export const HCM_API = {
  BASE: HCM_BASE,
  BALANCE: {
    BATCH: `${HCM_BASE}/balances/batch`,
    BY_CELL: (employeeId: string, locationId: string) =>
      `${HCM_BASE}/balances/${employeeId}/${locationId}`,
  },
  REQUEST: {
    LIST: `${HCM_BASE}/requests`,
    CREATE: `${HCM_BASE}/requests`,
    BY_ID: (requestId: string) => `${HCM_BASE}/requests/${requestId}`,
  },
  APPROVAL: {
    PENDING: `${HCM_BASE}/approvals/pending`,
  },
  SIMULATE: {
    ANNIVERSARY: `${HCM_BASE}/simulate/anniversary`,
    SILENT_FAIL: `${HCM_BASE}/simulate/silent-fail`,
    CONFLICT: `${HCM_BASE}/simulate/conflict`,
    SLOW: `${HCM_BASE}/simulate/slow`,
  },
} as const;
