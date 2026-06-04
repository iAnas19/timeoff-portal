import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HCM_ERROR_CODE } from "@/shared/api/errors";
import { REQUEST_STATUS } from "@/shared/hcm/constants";
import { MOCK_AUTH_HEADERS } from "@/mocks/mswHandlers";
import { handleHcmRequest } from "@/mocks/router";
import {
  armSilentFail,
  getCell,
  isStoreRouteError,
  listRequests,
  patchRequest,
  resetStore,
  writeCell,
} from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";

const ALICE = SEED_IDS.employee.alice;
const NYC = SEED_IDS.location.nyc;
const REQ = SEED_IDS.request.pending;

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { ...MOCK_AUTH_HEADERS, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("store edges", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("rejects an approval the live balance can no longer cover", () => {
    // Drop the cell below the seeded request's 2 days, then approve it.
    writeCell(ALICE, NYC, { confirmedBalance: 1, pendingDeductions: 0 });
    try {
      patchRequest(REQ, { status: REQUEST_STATUS.APPROVED });
      expect.unreachable("should throw");
    } catch (error) {
      expect(isStoreRouteError(error)).toBe(true);
      if (isStoreRouteError(error)) {
        expect(error.hcmError.code).toBe(HCM_ERROR_CODE.INSUFFICIENT_BALANCE);
      }
    }
  });

  it("silent-fail on a patch returns success but does not persist", () => {
    armSilentFail();
    const updated = patchRequest(REQ, { status: REQUEST_STATUS.APPROVED });
    expect(updated.status).toBe(REQUEST_STATUS.APPROVED);

    // Not actually persisted: the request is still pending, balance untouched.
    const stored = listRequests().find((r) => r.id === REQ);
    expect(stored?.status).toBe(REQUEST_STATUS.PENDING);
    expect(getCell(ALICE, NYC).confirmedBalance).toBe(10);
  });
});

describe("router edges", () => {
  beforeEach(() => resetStore());
  afterEach(() => resetStore());

  it("writes a cell via POST and rejects an invalid body", async () => {
    const ok = await handleHcmRequest(
      req("POST", `/api/hcm/balances/${ALICE}/${NYC}`, {
        confirmedBalance: 9,
        pendingDeductions: 1,
      }),
    );
    expect(ok.status).toBe(200);

    const bad = await handleHcmRequest(
      req("POST", `/api/hcm/balances/${ALICE}/${NYC}`, { confirmedBalance: -1 }),
    );
    expect(bad.status).toBe(400);
  });

  it("rejects an invalid PATCH body", async () => {
    const res = await handleHcmRequest(
      req("PATCH", `/api/hcm/requests/${REQ}`, { status: "bogus" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid anniversary body", async () => {
    const res = await handleHcmRequest(
      req("POST", "/api/hcm/simulate/anniversary", {}),
    );
    expect(res.status).toBe(400);
  });
});
