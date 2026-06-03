import { delay, http, HttpResponse } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { fetchBalance, fetchBalanceBatch } from "@/features/balances/balance.service";
import { hcmGet } from "@/shared/api/client";
import { HCM_ERROR_CODE, isHCMError } from "@/shared/api/errors";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";
import { balanceBatchResponseSchema } from "@/shared/hcm/schemas";

const ALICE = SEED_IDS.employee.alice;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    throw new Error("expected the call to reject");
  } catch (error) {
    if (isHCMError(error)) {
      return error.code;
    }
    throw error;
  }
}

describe("service error mapping (every HCMErrorCode reaches the client typed)", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("maps an unknown employee/location pair to INVALID_DIMENSION", async () => {
    expect(await codeOf(fetchBalance(ALICE, "loc-does-not-exist"))).toBe(
      HCM_ERROR_CODE.INVALID_DIMENSION,
    );
  });

  it("maps a transport failure to NETWORK", async () => {
    hcmServer.use(
      http.get("*/api/hcm/balances/batch", () => HttpResponse.error()),
    );
    expect(await codeOf(fetchBalanceBatch())).toBe(HCM_ERROR_CODE.NETWORK);
  });

  it("maps an aborted (slow) request to TIMEOUT", async () => {
    hcmServer.use(
      http.get("*/api/hcm/balances/batch", async () => {
        await delay(5_000); // exceeds the 2s test timeout → AbortController fires
        return HttpResponse.json({ balances: [] });
      }),
    );
    expect(await codeOf(fetchBalanceBatch())).toBe(HCM_ERROR_CODE.TIMEOUT);
  });

  it("maps an unrecognized server failure to UNKNOWN", async () => {
    hcmServer.use(
      http.get("*/api/hcm/balances/batch", () =>
        HttpResponse.json({ oops: true }, { status: 500 }),
      ),
    );
    expect(await codeOf(fetchBalanceBatch())).toBe(HCM_ERROR_CODE.UNKNOWN);
  });

  it("rejects a response that fails Zod validation rather than passing it through", async () => {
    hcmServer.use(
      http.get("*/api/hcm/balances/batch", () =>
        HttpResponse.json({ balances: [{ employeeId: "x" }] }),
      ),
    );
    await expect(
      hcmGet("/api/hcm/balances/batch", balanceBatchResponseSchema),
    ).rejects.toBeDefined();
  });
});
