import { describe, expect, it } from "vitest";
import type { BalanceCell } from "@/shared/hcm/schemas";
import { applyOptimisticDeductionToCell } from "@/features/balances/balance.utils";
import {
  APPROVAL_KEYS,
  BALANCE_KEYS,
  MUTATION_KEYS,
  REQUEST_KEYS,
} from "@/shared/hcm/queryKeys";

describe("BALANCE_KEYS", () => {
  it("exposes the root tree", () => {
    expect(BALANCE_KEYS.all).toEqual(["balances"]);
  });

  it("nests byEmployee under all", () => {
    expect(BALANCE_KEYS.byEmployee("emp-001")).toEqual(["balances", "emp-001"]);
  });

  it("nests byEmployeeAndLocation under byEmployee under all", () => {
    const key = BALANCE_KEYS.byEmployeeAndLocation("emp-001", "loc-nyc");

    expect(key).toEqual(["balances", "emp-001", "loc-nyc"]);

    // Hierarchy: byEmployeeAndLocation starts with byEmployee, which starts with all.
    const employeeKey = BALANCE_KEYS.byEmployee("emp-001");
    expect(key.slice(0, employeeKey.length)).toEqual([...employeeKey]);
    expect(employeeKey.slice(0, BALANCE_KEYS.all.length)).toEqual([
      ...BALANCE_KEYS.all,
    ]);
  });

  it("places overlay OUTSIDE the balances tree under its own root", () => {
    const key = BALANCE_KEYS.overlay("emp-001", "loc-nyc");

    expect(key).toEqual(["balance-overlay", "emp-001", "loc-nyc"]);
    expect(key[0]).toBe("balance-overlay");
    // It must NOT share the "balances" root, so invalidating a balance
    // key can never wipe an overlay banner.
    expect(key[0]).not.toBe(BALANCE_KEYS.all[0]);
  });
});

describe("REQUEST_KEYS", () => {
  it("exposes the root tree", () => {
    expect(REQUEST_KEYS.all).toEqual(["requests"]);
  });

  it("nests byEmployee under all", () => {
    const key = REQUEST_KEYS.byEmployee("emp-001");

    expect(key).toEqual(["requests", "emp-001"]);
    expect(key.slice(0, REQUEST_KEYS.all.length)).toEqual([
      ...REQUEST_KEYS.all,
    ]);
  });

  it("nests byId under all with a 'detail' segment", () => {
    const key = REQUEST_KEYS.byId("req-123");

    expect(key).toEqual(["requests", "detail", "req-123"]);
    expect(key.slice(0, REQUEST_KEYS.all.length)).toEqual([
      ...REQUEST_KEYS.all,
    ]);
  });
});

describe("APPROVAL_KEYS", () => {
  it("exposes the root tree", () => {
    expect(APPROVAL_KEYS.all).toEqual(["approvals"]);
  });

  it("nests pending under all", () => {
    const key = APPROVAL_KEYS.pending();

    expect(key).toEqual(["approvals", "pending"]);
    expect(key.slice(0, APPROVAL_KEYS.all.length)).toEqual([
      ...APPROVAL_KEYS.all,
    ]);
  });

  it("nests byManager under all with a 'manager' segment", () => {
    const key = APPROVAL_KEYS.byManager("mgr-007");

    expect(key).toEqual(["approvals", "manager", "mgr-007"]);
    expect(key.slice(0, APPROVAL_KEYS.all.length)).toEqual([
      ...APPROVAL_KEYS.all,
    ]);
  });
});

describe("MUTATION_KEYS", () => {
  it("derives submitRequest from the requests tree", () => {
    expect(MUTATION_KEYS.submitRequest).toEqual(["requests", "submit"]);
    expect(MUTATION_KEYS.submitRequest.slice(0, REQUEST_KEYS.all.length)).toEqual(
      [...REQUEST_KEYS.all],
    );
  });

  it("derives approveRequest and denyRequest from the approvals tree", () => {
    expect(MUTATION_KEYS.approveRequest).toEqual(["approvals", "approve"]);
    expect(MUTATION_KEYS.denyRequest).toEqual(["approvals", "deny"]);

    expect(
      MUTATION_KEYS.approveRequest.slice(0, APPROVAL_KEYS.all.length),
    ).toEqual([...APPROVAL_KEYS.all]);
    expect(MUTATION_KEYS.denyRequest.slice(0, APPROVAL_KEYS.all.length)).toEqual(
      [...APPROVAL_KEYS.all],
    );
  });
});

describe("applyOptimisticDeductionToCell early return", () => {
  const CELL: BalanceCell = {
    employeeId: "emp-001",
    locationId: "loc-nyc",
    locationName: "New York",
    confirmedBalance: 10,
    pendingDeductions: 2,
    asOf: "2026-06-01T12:00:00.000Z",
  };

  it("returns the SAME cell reference for days === 0", () => {
    expect(applyOptimisticDeductionToCell(CELL, 0)).toBe(CELL);
  });

  it("returns the SAME cell reference for negative days", () => {
    expect(applyOptimisticDeductionToCell(CELL, -3)).toBe(CELL);
  });
});
