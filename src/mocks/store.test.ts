import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HCM_ERROR_CODE } from "@/shared/api/errors";
import { HCM_API } from "@/shared/hcm/endpoints";
import { REQUEST_STATUS } from "@/shared/hcm/constants";
import { MOCK_AUTH_HEADERS } from "@/mocks/mswHandlers";
import { handleHcmRequest } from "@/mocks/router";
import { hcmServer } from "@/mocks/server";
import {
  armConflict,
  armSilentFail,
  createRequest,
  getBatch,
  getCell,
  getPendingApprovals,
  isStoreRouteError,
  listRequests,
  resetStore,
  simulateAnniversary,
  writeCell,
} from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";

beforeEach(() => {
  resetStore();
});

describe("mock HCM store", () => {
  it("returns the seed batch corpus", () => {
    expect(getBatch().balances).toHaveLength(3);
  });

  it("reads an authoritative cell", () => {
    const cell = getCell(SEED_IDS.employee.alice, SEED_IDS.location.nyc);
    expect(cell.confirmedBalance).toBe(10);
  });

  it("writes a cell when valid", () => {
    writeCell(SEED_IDS.employee.alice, SEED_IDS.location.remote, {
      confirmedBalance: 4,
      pendingDeductions: 1,
    });

    expect(
      getCell(SEED_IDS.employee.alice, SEED_IDS.location.remote)
        .confirmedBalance,
    ).toBe(4);
  });

  it("rejects invalid dimensions", () => {
    try {
      getCell("emp-999", SEED_IDS.location.nyc);
      expect.unreachable("should throw");
    } catch (error) {
      expect(isStoreRouteError(error)).toBe(true);
      if (isStoreRouteError(error)) {
        expect(error.hcmError.code).toBe(HCM_ERROR_CODE.INVALID_DIMENSION);
      }
    }
  });

  it("rejects insufficient balance on request create", () => {
    try {
      createRequest({
        employeeId: SEED_IDS.employee.alice,
        locationId: SEED_IDS.location.nyc,
        days: 20,
        startDate: "2026-08-01",
        endDate: "2026-08-20",
      });
      expect.unreachable("should throw");
    } catch (error) {
      expect(isStoreRouteError(error)).toBe(true);
      if (isStoreRouteError(error)) {
        expect(error.hcmError.code).toBe(HCM_ERROR_CODE.INSUFFICIENT_BALANCE);
      }
    }
  });

  it("rejects a request overlapping an existing one (no double-booking)", () => {
    // Seed has a pending Alice/NYC request for 2026-07-01..2026-07-02.
    try {
      createRequest({
        employeeId: SEED_IDS.employee.alice,
        locationId: SEED_IDS.location.nyc,
        days: 1,
        startDate: "2026-07-02",
        endDate: "2026-07-03",
      });
      expect.unreachable("should throw");
    } catch (error) {
      expect(isStoreRouteError(error)).toBe(true);
      if (isStoreRouteError(error)) {
        expect(error.hcmError.code).toBe(HCM_ERROR_CODE.CONFLICT);
        expect(error.status).toBe(409);
      }
    }
  });

  it("allows a non-overlapping request for the same cell", () => {
    const created = createRequest({
      employeeId: SEED_IDS.employee.alice,
      locationId: SEED_IDS.location.nyc,
      days: 1,
      startDate: "2026-07-10",
      endDate: "2026-07-10",
    });
    expect(created.status).toBe(REQUEST_STATUS.PENDING);
  });

  it("silent-fail returns success but does not persist write", () => {
    armSilentFail();
    writeCell(SEED_IDS.employee.alice, SEED_IDS.location.remote, {
      confirmedBalance: 99,
      pendingDeductions: 0,
    });

    expect(
      getCell(SEED_IDS.employee.alice, SEED_IDS.location.remote)
        .confirmedBalance,
    ).toBe(5);
  });

  it("conflict arms the next write", () => {
    armConflict();
    try {
      writeCell(SEED_IDS.employee.alice, SEED_IDS.location.remote, {
        confirmedBalance: 4,
        pendingDeductions: 0,
      });
      expect.unreachable("should throw");
    } catch (error) {
      expect(isStoreRouteError(error)).toBe(true);
      if (isStoreRouteError(error)) {
        expect(error.hcmError.code).toBe(HCM_ERROR_CODE.CONFLICT);
        expect(error.status).toBe(409);
      }
    }
  });

  it("anniversary bonus increments employee balances", () => {
    simulateAnniversary(SEED_IDS.employee.alice);
    expect(
      getCell(SEED_IDS.employee.alice, SEED_IDS.location.nyc).confirmedBalance,
    ).toBe(11);
  });

  it("lists all requests", () => {
    expect(listRequests()).toHaveLength(1);
  });

  it("returns pending approvals with display metadata", () => {
    const { approvals } = getPendingApprovals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.employeeDisplayName).toBe("Alice Chen");
    expect(approvals[0]?.locationName).toBe("New York");
  });
});

describe("mock HCM MSW handlers", () => {
  beforeAll(() => hcmServer.listen());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("serves batch GET through MSW", async () => {
    const response = await fetch(`http://localhost${HCM_API.BALANCE.BATCH}`, {
      headers: MOCK_AUTH_HEADERS,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.balances).toHaveLength(3);
  });

  it("rate-limits a burst of writes with HTTP 429", async () => {
    const burst = () =>
      handleHcmRequest(
        new Request("http://localhost/api/hcm/simulate/silent-fail", {
          method: "POST",
          headers: { ...MOCK_AUTH_HEADERS, "Content-Type": "application/json" },
          body: "{}",
        }),
      );

    let last: Response | undefined;
    for (let i = 0; i < 31; i += 1) {
      last = await burst();
    }
    expect(last?.status).toBe(429);
  });

  it("creates a pending request through MSW", async () => {
    const response = await fetch(`http://localhost${HCM_API.REQUEST.CREATE}`, {
      method: "POST",
      headers: {
        ...MOCK_AUTH_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        employeeId: SEED_IDS.employee.bob,
        locationId: SEED_IDS.location.london,
        days: 1,
        startDate: "2026-09-01",
        endDate: "2026-09-01",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe(REQUEST_STATUS.PENDING);
  });
});

describe("mock HCM CORS", () => {
  const ALLOWED = "http://localhost:3000";

  it("answers a preflight with 204 and allow headers for an allowed origin", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/hcm/balances/batch", {
        method: "OPTIONS",
        headers: { origin: ALLOWED },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("stamps CORS headers on a normal response for an allowed origin", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/hcm/balances/batch", {
        headers: { ...MOCK_AUTH_HEADERS, origin: ALLOWED },
      }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED);
  });

  it("does not echo CORS for a disallowed origin", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/hcm/balances/batch", {
        headers: { ...MOCK_AUTH_HEADERS, origin: "http://evil.example.com" },
      }),
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
