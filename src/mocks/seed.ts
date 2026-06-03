import { REQUEST_STATUS } from "@/shared/hcm/constants";
import type { BalanceCell, TimeOffRequest } from "@/shared/hcm/schemas";

export const SEED_IDS = {
  employee: {
    alice: "emp-001",
    bob: "emp-002",
  },
  location: {
    nyc: "loc-nyc",
    remote: "loc-remote",
    london: "loc-london",
  },
  request: {
    pending: "req-001",
  },
} as const;

const ANNIVERSARY_BONUS_DAYS = 1;

export { ANNIVERSARY_BONUS_DAYS };

function nowIso(): string {
  return new Date().toISOString();
}

export function createSeedData(): {
  balances: BalanceCell[];
  requests: TimeOffRequest[];
} {
  const timestamp = nowIso();

  return {
    balances: [
      {
        employeeId: SEED_IDS.employee.alice,
        locationId: SEED_IDS.location.nyc,
        locationName: "New York",
        confirmedBalance: 10,
        pendingDeductions: 2,
        asOf: timestamp,
      },
      {
        employeeId: SEED_IDS.employee.alice,
        locationId: SEED_IDS.location.remote,
        locationName: "Remote",
        confirmedBalance: 5,
        pendingDeductions: 0,
        asOf: timestamp,
      },
      {
        employeeId: SEED_IDS.employee.bob,
        locationId: SEED_IDS.location.london,
        locationName: "London",
        confirmedBalance: 8,
        pendingDeductions: 0,
        asOf: timestamp,
      },
    ],
    requests: [
      {
        id: SEED_IDS.request.pending,
        employeeId: SEED_IDS.employee.alice,
        locationId: SEED_IDS.location.nyc,
        days: 2,
        startDate: "2026-07-01",
        endDate: "2026-07-02",
        status: REQUEST_STATUS.PENDING,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}
