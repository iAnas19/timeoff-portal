import { createHCMError, HCM_ERROR_CODE } from "@/shared/api/errors";
import type {
  BalanceBatchResponse,
  BalanceCell,
  BalanceWriteInput,
  EmployeeBalances,
} from "@/shared/hcm/schemas";

const NOT_IMPLEMENTED = "Balance service not implemented — Phase 4+";

function notImplemented(): never {
  throw createHCMError({
    code: HCM_ERROR_CODE.UNKNOWN,
    message: NOT_IMPLEMENTED,
    retryable: false,
  });
}

export async function fetchBalanceBatch(): Promise<BalanceBatchResponse> {
  notImplemented();
}

export async function fetchBalance(
  employeeId: string,
  locationId: string,
): Promise<BalanceCell> {
  void employeeId;
  void locationId;
  notImplemented();
}

export async function writeBalance(
  employeeId: string,
  locationId: string,
  input: BalanceWriteInput,
): Promise<BalanceCell> {
  void employeeId;
  void locationId;
  void input;
  notImplemented();
}

export async function fetchEmployeeBalances(
  employeeId: string,
): Promise<EmployeeBalances> {
  void employeeId;
  notImplemented();
}
