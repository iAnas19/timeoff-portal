import { z } from "zod";
import { hcmGet, hcmPatch, hcmPost } from "@/shared/api/client";
import { HCM_API } from "@/shared/hcm/endpoints";
import {
  balanceBatchResponseSchema,
  balanceCellSchema,
  employeeBalancesSchema,
  type BalanceBatchResponse,
  type BalanceCell,
  type BalanceWriteInput,
  type EmployeeBalances,
} from "@/shared/hcm/schemas";

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

export async function writeBalance(
  employeeId: string,
  locationId: string,
  input: BalanceWriteInput,
): Promise<BalanceCell> {
  return hcmPost(
    HCM_API.BALANCE.BY_CELL(employeeId, locationId),
    input,
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
