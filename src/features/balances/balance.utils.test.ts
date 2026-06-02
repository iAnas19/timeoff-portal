import { describe, expect, it } from "vitest";
import type { EmployeeBalances } from "@/shared/hcm/schemas";
import {
  applyOptimisticDeduction,
  calculateAvailableBalance,
  detectSilentFailure,
  findBalanceCell,
  balancesAreEqual,
  shouldBufferPollResult,
  shouldShowRefreshedMidSession,
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

  it("buffers poll when mutation pending and values differ", () => {
    expect(
      shouldBufferPollResult({
        isMutationPending: true,
        polledConfirmedBalance: 12,
        displayedConfirmedBalance: 10,
      }),
    ).toBe(true);
  });

  it("treats near-equal balances as equal", () => {
    expect(balancesAreEqual(10, 10.0005)).toBe(true);
  });

  it("shows refreshed-mid-session when buffered poll differs after settle", () => {
    expect(
      shouldShowRefreshedMidSession({
        baselineConfirmedBalance: 10,
        settledConfirmedBalance: 12,
        hadBufferedPoll: true,
      }),
    ).toBe(true);
  });
});
