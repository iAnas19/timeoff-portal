import { describe, expect, it } from "vitest";
import type { EmployeeBalances } from "@/shared/hcm/schemas";
import {
  applyOptimisticDeduction,
  applyOptimisticDeductionToCell,
  calculateAvailableBalance,
  countInclusiveDays,
  detectExternalConfirmedChange,
  detectSilentFailure,
  findBalanceCell,
  balancesAreEqual,
} from "@/features/balances/balance.utils";

const SAMPLE_BALANCES: EmployeeBalances = {
  employeeId: "emp-001",
  balances: [
    {
      employeeId: "emp-001",
      locationId: "loc-nyc",
      locationName: "New York",
      confirmedBalance: 10,
      pendingDeductions: 2,
      asOf: "2026-06-01T12:00:00.000Z",
    },
    {
      employeeId: "emp-001",
      locationId: "loc-remote",
      locationName: "Remote",
      confirmedBalance: 5,
      pendingDeductions: 0,
      asOf: "2026-06-01T12:00:00.000Z",
    },
  ],
};

describe("calculateAvailableBalance", () => {
  it("returns confirmed minus pending, floored at zero", () => {
    expect(calculateAvailableBalance(10, 2)).toBe(8);
    expect(calculateAvailableBalance(3, 5)).toBe(0);
  });
});

describe("findBalanceCell", () => {
  it("returns the matching location row", () => {
    const cell = findBalanceCell(SAMPLE_BALANCES, "loc-nyc");
    expect(cell?.locationName).toBe("New York");
  });
});

describe("applyOptimisticDeduction", () => {
  it("increases pending deductions for the target location", () => {
    const next = applyOptimisticDeduction(SAMPLE_BALANCES, {
      locationId: "loc-nyc",
      days: 3,
    });

    expect(findBalanceCell(next, "loc-nyc")?.pendingDeductions).toBe(5);
  });

  it("does not change balances when deduction exceeds available", () => {
    const next = applyOptimisticDeduction(SAMPLE_BALANCES, {
      locationId: "loc-nyc",
      days: 9,
    });

    expect(next).toEqual(SAMPLE_BALANCES);
  });

  it("returns undefined when there is no current data", () => {
    expect(
      applyOptimisticDeduction(undefined, { locationId: "loc-nyc", days: 1 }),
    ).toBeUndefined();
  });
});

describe("reconciliation helpers", () => {
  it("detects silent failure when write succeeded but balance unchanged", () => {
    expect(
      detectSilentFailure({
        writeSucceeded: true,
        expectedConfirmedBalance: 7,
        actualConfirmedBalance: 10,
      }),
    ).toBe(true);
  });

  it("does not flag silent failure when write failed", () => {
    expect(
      detectSilentFailure({
        writeSucceeded: false,
        expectedConfirmedBalance: 7,
        actualConfirmedBalance: 10,
      }),
    ).toBe(false);
  });

  it("treats near-equal balances as equal", () => {
    expect(balancesAreEqual(10, 10.0005)).toBe(true);
  });

  it("flags an external confirmed-balance change against the last observed value", () => {
    expect(detectExternalConfirmedChange(10, 12)).toBe(true);
    expect(detectExternalConfirmedChange(10, 10)).toBe(false);
  });

  it("does not flag a change on the first observation (no baseline yet)", () => {
    expect(detectExternalConfirmedChange(undefined, 12)).toBe(false);
  });
});

describe("countInclusiveDays", () => {
  it("counts a single day as 1", () => {
    expect(countInclusiveDays("2026-08-01", "2026-08-01")).toBe(1);
  });

  it("counts an inclusive range", () => {
    expect(countInclusiveDays("2026-08-01", "2026-08-05")).toBe(5);
  });

  it("returns 0 for a reversed or invalid range", () => {
    expect(countInclusiveDays("2026-08-05", "2026-08-01")).toBe(0);
    expect(countInclusiveDays("", "2026-08-01")).toBe(0);
  });
});

describe("applyOptimisticDeductionToCell", () => {
  const cell = SAMPLE_BALANCES.balances[0];

  it("adds the requested days to pending deductions", () => {
    expect(applyOptimisticDeductionToCell(cell, 3).pendingDeductions).toBe(5);
  });

  it("leaves the cell unchanged when the deduction exceeds available", () => {
    expect(applyOptimisticDeductionToCell(cell, 99)).toEqual(cell);
  });

  it("leaves the cell unchanged for a non-positive deduction", () => {
    expect(applyOptimisticDeductionToCell(cell, 0)).toBe(cell);
  });
});
