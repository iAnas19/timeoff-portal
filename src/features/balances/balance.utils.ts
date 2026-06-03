import type { BalanceCell, EmployeeBalances } from "@/shared/hcm/schemas";
import type {
  OptimisticDeductionInput,
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

export function balancesAreEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < BALANCE_EPSILON;
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole calendar days covered by an inclusive date range. A single day
 * (start === end) counts as 1. Returns 0 for an invalid or reversed range so the
 * caller can treat it as "not yet valid" rather than a negative request.
 */
export function countInclusiveDays(startDate: string, endDate: string): number {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/**
 * Predicted display for one cell while a submit is in flight. The deduction is
 * layered on top of the authoritative cell, so a concurrent poll that refreshes
 * `confirmedBalance` (e.g. an anniversary bonus) can never erase it.
 */
export function applyOptimisticDeductionToCell(
  cell: BalanceCell,
  days: number,
): BalanceCell {
  if (days <= 0) {
    return cell;
  }

  const available = calculateAvailableBalance(
    cell.confirmedBalance,
    cell.pendingDeductions,
  );

  if (days > available) {
    return cell;
  }

  return { ...cell, pendingDeductions: cell.pendingDeductions + days };
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
    balances: current.balances.map((cell) =>
      cell.locationId === input.locationId
        ? applyOptimisticDeductionToCell(cell, input.days)
        : cell,
    ),
  };
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

/**
 * True when an authoritative poll reports a `confirmedBalance` that differs from
 * what we last observed for this cell. This view never mutates `confirmedBalance`
 * itself (submit only touches pending deductions), so any change is external —
 * an HCM-side refresh that should surface the `refreshed-mid-session` banner.
 */
export function detectExternalConfirmedChange(
  previousConfirmed: number | undefined,
  currentConfirmed: number,
): boolean {
  if (previousConfirmed === undefined) {
    return false;
  }

  return !balancesAreEqual(previousConfirmed, currentConfirmed);
}
