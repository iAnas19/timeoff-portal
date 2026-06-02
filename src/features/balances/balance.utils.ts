import type { EmployeeBalances } from "@/shared/hcm/schemas";
import type {
  OptimisticDeductionInput,
  PollBufferCheckInput,
  SilentFailureCheckInput,
} from "@/shared/hcm/types";

const BALANCE_EPSILON = 0.001;

export function calculateAvailableBalance(
  confirmedBalance: number,
  pendingDeductions: number,
): number {
  return Math.max(0, confirmedBalance - pendingDeductions);
}

export function findBalanceCell(
  data: EmployeeBalances | undefined,
  locationId: string,
) {
  return data?.balances.find((cell) => cell.locationId === locationId);
}

export function applyOptimisticDeduction(
  current: EmployeeBalances | undefined,
  input: OptimisticDeductionInput,
): EmployeeBalances | undefined {
  if (!current) {
    return current;
  }

  return {
    ...current,
    balances: current.balances.map((cell) => {
      if (cell.locationId !== input.locationId) {
        return cell;
      }

      const available = calculateAvailableBalance(
        cell.confirmedBalance,
        cell.pendingDeductions,
      );

      if (input.days > available) {
        return cell;
      }

      return {
        ...cell,
        pendingDeductions: cell.pendingDeductions + input.days,
      };
    }),
  };
}

export function balancesAreEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < BALANCE_EPSILON;
}

export function detectSilentFailure(input: SilentFailureCheckInput): boolean {
  if (!input.writeSucceeded) {
    return false;
  }

  return !balancesAreEqual(
    input.expectedConfirmedBalance,
    input.actualConfirmedBalance,
  );
}

export function shouldBufferPollResult(input: PollBufferCheckInput): boolean {
  if (!input.isMutationPending) {
    return false;
  }

  return !balancesAreEqual(
    input.polledConfirmedBalance,
    input.displayedConfirmedBalance,
  );
}

export function shouldShowRefreshedMidSession(input: {
  baselineConfirmedBalance: number;
  settledConfirmedBalance: number;
  hadBufferedPoll: boolean;
}): boolean {
  if (!input.hadBufferedPoll) {
    return false;
  }

  return !balancesAreEqual(
    input.baselineConfirmedBalance,
    input.settledConfirmedBalance,
  );
}
