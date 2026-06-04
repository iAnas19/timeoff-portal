import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fetchBalanceBatch } from "@/features/balances/balance.service";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";

describe("hcmFetch URL building", () => {
  beforeAll(() => hcmServer.listen());
  afterEach(() => {
    hcmServer.resetHandlers();
    vi.unstubAllGlobals();
    resetStore();
  });
  afterAll(() => hcmServer.close());

  it("builds an absolute URL when there is no window (server runtime)", async () => {
    vi.stubGlobal("window", undefined); // typeof window === "undefined" → server branch
    const batch = await fetchBalanceBatch();
    expect(batch.balances.length).toBeGreaterThan(0);
  });
});
