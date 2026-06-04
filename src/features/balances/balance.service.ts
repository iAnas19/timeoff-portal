import { z } from "zod";
import { hcmGet, hcmPost } from "@/shared/api/client";
import { HCM_API } from "@/shared/hcm/endpoints";
import {
  balanceBatchResponseSchema,
  balanceCellSchema,
  employeeBalancesSchema,
  type BalanceBatchResponse,
  type BalanceCell,
  type EmployeeBalances,
} from "@/shared/hcm/schemas";

const simulateArmedSchema = z.object({ armed: z.literal(true) }).strict();
const simulateAnniversarySchema = z.array(balanceCellSchema);

export async function fetchBalanceBatch(): Promise<BalanceBatchResponse> {
  return hcmGet(HCM_API.BALANCE.BATCH, balanceBatchResponseSchema);
}

export async function fetchBalance(
  employeeId: string,
  locationId: string,
): Promise<BalanceCell> {
  return hcmGet(
    HCM_API.BALANCE.BY_CELL(employeeId, locationId),
    balanceCellSchema,
  );
}

export async function fetchEmployeeBalances(
  employeeId: string,
): Promise<EmployeeBalances> {
  const batch = await fetchBalanceBatch();
  return employeeBalancesSchema.parse({
    employeeId,
    balances: batch.balances.filter((cell) => cell.employeeId === employeeId),
  });
}

export async function simulateAnniversary(
  employeeId: string,
): Promise<BalanceCell[]> {
  return hcmPost(
    HCM_API.SIMULATE.ANNIVERSARY,
    { employeeId },
    simulateAnniversarySchema,
  );
}

export async function armSilentFailScenario(): Promise<void> {
  await hcmPost(HCM_API.SIMULATE.SILENT_FAIL, {}, simulateArmedSchema);
}

export async function armConflictScenario(): Promise<void> {
  await hcmPost(HCM_API.SIMULATE.CONFLICT, {}, simulateArmedSchema);
}
