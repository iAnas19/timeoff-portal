import { nanoid } from "nanoid";
import { createHCMError, HCM_ERROR_CODE } from "@/shared/api/errors";
import { BALANCE_FRESHNESS, REQUEST_STATUS } from "@/shared/hcm/constants";
import type {
  BalanceBatchResponse,
  BalanceCell,
  BalanceWriteInput,
  PatchTimeOffRequestInput,
  PendingApprovalsResponse,
  SubmitTimeOffRequestInput,
  TimeOffRequest,
} from "@/shared/hcm/schemas";
import { ANNIVERSARY_BONUS_DAYS, createSeedData, SEED_IDS } from "@/mocks/seed";

const DISPLAY_NAMES: Record<string, string> = {
  [SEED_IDS.employee.alice]: "Alice Chen",
  [SEED_IDS.employee.bob]: "Bob Patel",
};

type ArmedFlags = {
  silentFail: boolean;
  conflict: boolean;
  slow: boolean;
};

let balances: BalanceCell[] = [];
let requests: TimeOffRequest[] = [];
let armed: ArmedFlags = { silentFail: false, conflict: false, slow: false };
let writeTimestamps: number[] = [];

// Kept strictly BELOW the client request timeout (config HCM_API_TIMEOUT_MS, 8s)
// so the "slow" demo reliably exercises a sustained loading state that then
// SUCCEEDS - matching what the UI promises. A genuine timeout-then-the-write-
// still-landed outcome (the real honesty hazard) is reconciled on settle in
// useSubmitRequest and covered by its own test, rather than left to a coin-flip
// on whether the random delay happened to exceed the timeout.
const SLOW_DELAY_MIN_MS = 3_000;
const SLOW_DELAY_MAX_MS = 6_000;

const RATE_LIMIT_MAX_WRITES = 30;
const RATE_LIMIT_WINDOW_MS = 10_000;

function nowIso(): string {
  return new Date().toISOString();
}

function fail(code: HCM_ERROR_CODE, message: string, status: number): never {
  throw { hcmError: createHCMError({ code, message, retryable: false }), status };
}

function findCellIndex(employeeId: string, locationId: string): number {
  return balances.findIndex(
    (cell) =>
      cell.employeeId === employeeId && cell.locationId === locationId,
  );
}

function getCellOrFail(employeeId: string, locationId: string): BalanceCell {
  const index = findCellIndex(employeeId, locationId);
  if (index === -1) {
    fail(
      HCM_ERROR_CODE.INVALID_DIMENSION,
      "Unknown employee and location combination",
      400,
    );
  }
  return balances[index];
}

function availableDays(cell: BalanceCell): number {
  return Math.max(0, cell.confirmedBalance - cell.pendingDeductions);
}

function refreshAsOf(cell: BalanceCell): BalanceCell {
  return { ...cell, asOf: nowIso() };
}

export function resetStore(): void {
  const seed = createSeedData();
  balances = structuredClone(seed.balances);
  requests = structuredClone(seed.requests);
  armed = { silentFail: false, conflict: false, slow: false };
  writeTimestamps = [];
}

/**
 * Fixed-window rate limit on mutating calls. Mirrors what a real HCM would do to
 * protect itself; the window is generous enough for normal use but a tight loop
 * will trip it. Reads are never limited (polling must stay free).
 */
export function enforceWriteRateLimit(): void {
  const now = Date.now();
  writeTimestamps = writeTimestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (writeTimestamps.length >= RATE_LIMIT_MAX_WRITES) {
    throw {
      hcmError: createHCMError({
        code: HCM_ERROR_CODE.UNKNOWN,
        message: "Too many writes - slow down and retry.",
        retryable: true,
      }),
      status: 429,
    };
  }

  writeTimestamps.push(now);
}

resetStore();

export function getArmedFlags(): ArmedFlags {
  return { ...armed };
}

export async function applySlowDelayIfArmed(): Promise<void> {
  if (!armed.slow) {
    return;
  }

  armed.slow = false;
  const delayMs =
    SLOW_DELAY_MIN_MS +
    Math.floor(Math.random() * (SLOW_DELAY_MAX_MS - SLOW_DELAY_MIN_MS + 1));

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function getBatch(): BalanceBatchResponse {
  return {
    balances: balances.map((cell) => refreshAsOf({ ...cell })),
  };
}

export function getCell(employeeId: string, locationId: string): BalanceCell {
  return refreshAsOf(getCellOrFail(employeeId, locationId));
}

export function writeCell(
  employeeId: string,
  locationId: string,
  input: BalanceWriteInput,
): BalanceCell {
  const index = findCellIndex(employeeId, locationId);
  if (index === -1) {
    fail(
      HCM_ERROR_CODE.INVALID_DIMENSION,
      "Unknown employee and location combination",
      400,
    );
  }

  if (armed.conflict) {
    armed.conflict = false;
    fail(HCM_ERROR_CODE.CONFLICT, "Write conflict - retry later", 409);
  }

  const nextCell = refreshAsOf({
    ...balances[index],
    confirmedBalance: input.confirmedBalance,
    pendingDeductions: input.pendingDeductions,
  });

  if (armed.silentFail) {
    armed.silentFail = false;
    return nextCell;
  }

  balances[index] = nextCell;
  return { ...nextCell };
}

export function createRequest(input: SubmitTimeOffRequestInput): TimeOffRequest {
  const index = findCellIndex(input.employeeId, input.locationId);
  if (index === -1) {
    fail(
      HCM_ERROR_CODE.INVALID_DIMENSION,
      "Unknown employee and location combination",
      400,
    );
  }

  if (armed.conflict) {
    armed.conflict = false;
    fail(HCM_ERROR_CODE.CONFLICT, "Write conflict - retry later", 409);
  }

  // Reject a request whose dates overlap one that is already pending or approved
  // for this employee + location - you cannot book the same day twice.
  const hasOverlap = requests.some(
    (existing) =>
      existing.employeeId === input.employeeId &&
      existing.locationId === input.locationId &&
      (existing.status === REQUEST_STATUS.PENDING ||
        existing.status === REQUEST_STATUS.APPROVED) &&
      input.startDate <= existing.endDate &&
      existing.startDate <= input.endDate,
  );
  if (hasOverlap) {
    fail(
      HCM_ERROR_CODE.CONFLICT,
      "A leave request already covers one or more of those dates.",
      409,
    );
  }

  const cell = balances[index];
  if (input.days > availableDays(cell)) {
    fail(
      HCM_ERROR_CODE.INSUFFICIENT_BALANCE,
      "Insufficient balance for this request",
      400,
    );
  }

  const timestamp = nowIso();
  const request: TimeOffRequest = {
    id: `req-${nanoid(8)}`,
    employeeId: input.employeeId,
    locationId: input.locationId,
    days: input.days,
    startDate: input.startDate,
    endDate: input.endDate,
    status: REQUEST_STATUS.PENDING,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nextPending = cell.pendingDeductions + input.days;
  const updatedCell = refreshAsOf({
    ...cell,
    pendingDeductions: nextPending,
  });

  if (armed.silentFail) {
    armed.silentFail = false;
    return request;
  }

  balances[index] = updatedCell;
  requests.push(request);
  return request;
}

export function patchRequest(
  requestId: string,
  input: PatchTimeOffRequestInput,
): TimeOffRequest {
  const requestIndex = requests.findIndex((item) => item.id === requestId);
  if (requestIndex === -1) {
    fail(HCM_ERROR_CODE.INVALID_DIMENSION, "Request not found", 404);
  }

  if (armed.conflict) {
    armed.conflict = false;
    fail(HCM_ERROR_CODE.CONFLICT, "Write conflict - retry later", 409);
  }

  const request = requests[requestIndex];
  const cellIndex = findCellIndex(request.employeeId, request.locationId);
  if (cellIndex === -1) {
    fail(HCM_ERROR_CODE.INVALID_DIMENSION, "Request balance cell missing", 400);
  }

  const cell = balances[cellIndex];
  const timestamp = nowIso();

  let nextCell = cell;

  if (input.status === REQUEST_STATUS.APPROVED) {
    if (request.days > availableDays(cell)) {
      fail(
        HCM_ERROR_CODE.INSUFFICIENT_BALANCE,
        "Insufficient balance to approve",
        400,
      );
    }

    nextCell = refreshAsOf({
      ...cell,
      confirmedBalance: cell.confirmedBalance - request.days,
      pendingDeductions: Math.max(0, cell.pendingDeductions - request.days),
    });
  }

  if (input.status === REQUEST_STATUS.DENIED) {
    nextCell = refreshAsOf({
      ...cell,
      pendingDeductions: Math.max(0, cell.pendingDeductions - request.days),
    });
  }

  const updated: TimeOffRequest = {
    ...request,
    status: input.status,
    updatedAt: timestamp,
  };

  if (armed.silentFail) {
    armed.silentFail = false;
    return updated;
  }

  balances[cellIndex] = nextCell;
  requests[requestIndex] = updated;
  return updated;
}

export function listRequests(): TimeOffRequest[] {
  return requests.map((request) => ({ ...request }));
}

export function getPendingApprovals(): PendingApprovalsResponse {
  return {
    approvals: requests
      .filter((request) => request.status === REQUEST_STATUS.PENDING)
      .map((request) => {
        const cell = getCellOrFail(request.employeeId, request.locationId);
        return {
          request,
          employeeDisplayName:
            DISPLAY_NAMES[request.employeeId] ?? request.employeeId,
          locationName: cell.locationName,
          balanceAtQueueTime: refreshAsOf({ ...cell }),
          balanceFreshness: BALANCE_FRESHNESS.FRESH,
        };
      }),
  };
}

export function simulateAnniversary(employeeId: string): BalanceCell[] {
  let found = false;
  const updated: BalanceCell[] = [];

  balances = balances.map((cell) => {
    if (cell.employeeId !== employeeId) {
      return cell;
    }

    found = true;
    const next = refreshAsOf({
      ...cell,
      confirmedBalance: cell.confirmedBalance + ANNIVERSARY_BONUS_DAYS,
    });
    updated.push(next);
    return next;
  });

  if (!found) {
    fail(HCM_ERROR_CODE.INVALID_DIMENSION, "Unknown employee", 400);
  }

  return updated;
}

export function armSilentFail(): void {
  armed.silentFail = true;
}

export function armConflict(): void {
  armed.conflict = true;
}

export function armSlow(): void {
  armed.slow = true;
}

export type StoreRouteError = {
  hcmError: ReturnType<typeof createHCMError>;
  status: number;
};

export function isStoreRouteError(error: unknown): error is StoreRouteError {
  return (
    typeof error === "object" &&
    error !== null &&
    "hcmError" in error &&
    "status" in error
  );
}
