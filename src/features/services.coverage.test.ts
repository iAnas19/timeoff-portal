import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  armConflictScenario,
  armSilentFailScenario,
  armSlowScenario,
  fetchEmployeeBalances,
  simulateAnniversary,
} from "@/features/balances/balance.service";
import { patchRequest } from "@/features/requests/request.service";
import { denyRequest } from "@/features/approvals/approval.service";
import { REQUEST_STATUS } from "@/shared/hcm/constants";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";
import { SEED_IDS } from "@/mocks/seed";

describe("service layer coverage", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  describe("balance.service", () => {
    it("fetchEmployeeBalances returns only the requested employee's rows", async () => {
      const result = await fetchEmployeeBalances(SEED_IDS.employee.alice);

      expect(result.employeeId).toBe(SEED_IDS.employee.alice);
      expect(result.balances).toHaveLength(2);
      expect(
        result.balances.every(
          (cell) => cell.employeeId === SEED_IDS.employee.alice,
        ),
      ).toBe(true);
      const locationIds = result.balances.map((cell) => cell.locationId).sort();
      expect(locationIds).toEqual(
        [SEED_IDS.location.nyc, SEED_IDS.location.remote].sort(),
      );
    });

    it("simulateAnniversary returns the bumped cells with confirmedBalance +1", async () => {
      const bumped = await simulateAnniversary(SEED_IDS.employee.alice);

      expect(bumped).toHaveLength(2);
      expect(
        bumped.every((cell) => cell.employeeId === SEED_IDS.employee.alice),
      ).toBe(true);

      const nyc = bumped.find(
        (cell) => cell.locationId === SEED_IDS.location.nyc,
      );
      const remote = bumped.find(
        (cell) => cell.locationId === SEED_IDS.location.remote,
      );
      // Seed: NYC confirmed 10, Remote confirmed 5; anniversary adds +1 each.
      expect(nyc?.confirmedBalance).toBe(11);
      expect(remote?.confirmedBalance).toBe(6);
    });

    it("armSilentFailScenario resolves after arming the scenario", async () => {
      await expect(armSilentFailScenario()).resolves.toBeUndefined();
    });

    it("armConflictScenario resolves after arming the scenario", async () => {
      await expect(armConflictScenario()).resolves.toBeUndefined();
    });

    it("armSlowScenario resolves after arming the scenario", async () => {
      await expect(armSlowScenario()).resolves.toBeUndefined();
    });
  });

  describe("request.service", () => {
    it("patchRequest returns the updated request with the new status", async () => {
      const updated = await patchRequest(SEED_IDS.request.pending, {
        status: REQUEST_STATUS.APPROVED,
      });

      expect(updated.id).toBe(SEED_IDS.request.pending);
      expect(updated.status).toBe(REQUEST_STATUS.APPROVED);
    });
  });

  describe("approval.service", () => {
    it("denyRequest returns the request with a denied status", async () => {
      const denied = await denyRequest(SEED_IDS.request.pending, {});

      expect(denied.id).toBe(SEED_IDS.request.pending);
      expect(denied.status).toBe(REQUEST_STATUS.DENIED);
    });
  });
});
