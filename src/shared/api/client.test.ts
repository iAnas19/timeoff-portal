import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fetchBalanceBatch } from "@/features/balances/balance.service";
import { fetchPendingApprovals } from "@/features/approvals/approval.service";
import { fetchEmployeeRequests } from "@/features/requests/request.service";
import { handleHcmRequest } from "@/mocks/router";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";

describe("hcm client + services", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("fetches balance batch through the shared client", async () => {
    const batch = await fetchBalanceBatch();
    expect(batch.balances.length).toBeGreaterThan(0);
  });

  it("fetches pending approvals through the shared client", async () => {
    const { approvals } = await fetchPendingApprovals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.request.id).toBe(SEED_IDS.request.pending);
  });

  it("filters employee requests client-side after list fetch", async () => {
    const aliceRequests = await fetchEmployeeRequests(SEED_IDS.employee.alice);
    expect(aliceRequests).toHaveLength(1);
  });

  it("rejects unauthenticated mock requests at the router", async () => {
    const request = new Request("http://localhost/api/hcm/balances/batch", {
      method: "GET",
    });
    const response = await handleHcmRequest(request);
    expect(response.status).toBe(401);
  });
});
