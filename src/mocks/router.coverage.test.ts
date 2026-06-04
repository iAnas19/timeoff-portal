import { beforeEach, describe, expect, it } from "vitest";
import { HCM_ERROR_CODE } from "@/shared/api/errors";
import { MOCK_AUTH_HEADERS } from "@/mocks/mswHandlers";
import { handleHcmRequest } from "@/mocks/router";
import {
  getBatch,
  isStoreRouteError,
  patchRequest,
  resetStore,
  simulateAnniversary,
} from "@/mocks/store";
import { REQUEST_STATUS } from "@/shared/hcm/constants";
import { SEED_IDS } from "@/mocks/seed";
import type { BalanceCell } from "@/shared/hcm/schemas";

const JSON_HEADERS = { ...MOCK_AUTH_HEADERS, "Content-Type": "application/json" };

beforeEach(() => {
  resetStore();
});

describe("handleHcmRequest router coverage", () => {
  it("arms slow without triggering a real slow request (200 {armed:true})", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/hcm/simulate/slow", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ armed: true });

    // Disarm the slow flag so it does not delay any later request: reset
    // restores the store (and clears armed.slow) for the next test.
    resetStore();
  });

  it("resets the store (200 {reset:true})", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/hcm/simulate/reset", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ reset: true });
  });

  it("returns 404 for an unknown HCM path", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/hcm/nope", {
        method: "GET",
        headers: MOCK_AUTH_HEADERS,
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe(HCM_ERROR_CODE.UNKNOWN);
  });

  it("returns 400 for an invalid JSON body on POST /requests", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/hcm/requests", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "not json",
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe(HCM_ERROR_CODE.UNKNOWN);
  });

  it("returns 400 'Not an HCM path' for a non-/api/hcm path", async () => {
    const res = await handleHcmRequest(
      new Request("http://localhost/api/other", {
        method: "GET",
        headers: MOCK_AUTH_HEADERS,
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe(HCM_ERROR_CODE.UNKNOWN);
    expect(body.message).toBe("Not an HCM path");
  });
});

describe("store coverage", () => {
  it("denies a pending request and reduces pendingDeductions", () => {
    // Seed: Alice/NYC has pendingDeductions 2; req-001 (Alice/NYC) is 2 days.
    const updated = patchRequest(SEED_IDS.request.pending, {
      status: REQUEST_STATUS.DENIED,
    });

    expect(updated.status).toBe(REQUEST_STATUS.DENIED);

    // Denying the 2-day pending request drops pendingDeductions from 2 to 0.
    const cell = getBatchCell(SEED_IDS.employee.alice, SEED_IDS.location.nyc);
    expect(cell.pendingDeductions).toBe(0);
  });

  it("throws a StoreRouteError with INVALID_DIMENSION for an unknown employee", () => {
    try {
      simulateAnniversary("emp-unknown");
      expect.unreachable("simulateAnniversary should throw");
    } catch (error) {
      expect(isStoreRouteError(error)).toBe(true);
      if (isStoreRouteError(error)) {
        expect(error.hcmError.code).toBe(HCM_ERROR_CODE.INVALID_DIMENSION);
      }
    }
  });

  it("isStoreRouteError is false for a plain object and for null", () => {
    expect(isStoreRouteError({})).toBe(false);
    expect(isStoreRouteError(null)).toBe(false);
  });
});

// Reads the current Alice/NYC cell from the authoritative store batch.
function getBatchCell(employeeId: string, locationId: string): BalanceCell {
  const cell = getBatch().balances.find(
    (item) => item.employeeId === employeeId && item.locationId === locationId,
  );
  if (!cell) {
    throw new Error(`No cell for ${employeeId}/${locationId}`);
  }
  return cell;
}
