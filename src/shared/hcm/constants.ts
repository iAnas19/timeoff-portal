/** Polling & cache */
export const BALANCE_POLL_INTERVAL_MS = 30_000;
export const BALANCE_BATCH_STALE_TIME_MS = 60_000;
// Match the poll cadence: a cell stays "fresh" between polls, so routine refetches
// don't flip the card to a stale state. Explicit invalidation (reconciliation)
// ignores staleTime, so correctness is unaffected.
export const BALANCE_CELL_STALE_TIME_MS = BALANCE_POLL_INTERVAL_MS;
export const REQUEST_LIST_STALE_TIME_MS = 15_000;
export const NO_GARBAGE_COLLECTION = 0;
export const MAX_HCM_RETRIES = 3;

/** Request form limits — whole days, derived from an inclusive date range */
export const MIN_REQUEST_DAYS = 1;
export const MAX_REQUEST_DAYS = 365;

/** Balance card UI states */
export enum BALANCE_DISPLAY_STATUS {
  IDLE = "idle",
  LOADING = "loading",
  STALE = "stale",
  OPTIMISTIC_PENDING = "optimistic-pending",
  OPTIMISTIC_ROLLED_BACK = "optimistic-rolled-back",
  HCM_REJECTED = "hcm-rejected",
  HCM_SILENT_CONFLICT = "hcm-silent-conflict",
  REFRESHED_MID_SESSION = "refreshed-mid-session",
  ERROR = "error",
  SUCCESS = "success",
}

/** Employee request form UI states */
export enum REQUEST_FORM_STATUS {
  IDLE = "idle",
  VALIDATING = "validating",
  SUBMITTING = "submitting",
  SUBMIT_SUCCESS = "submit-success",
  SUBMIT_ROLLED_BACK = "submit-rolled-back",
  SUBMIT_HCM_REJECTED = "submit-hcm-rejected",
  SUBMIT_SILENT_CONFLICT = "submit-silent-conflict",
}

/** HCM request record status */
export enum REQUEST_STATUS {
  PENDING = "pending",
  APPROVED = "approved",
  DENIED = "denied",
}

/** Manager approval card UI states */
export enum APPROVAL_CARD_STATUS {
  PENDING_FRESH_BALANCE = "pending-fresh-balance",
  PENDING_STALE_BALANCE = "pending-stale-balance",
  APPROVING = "approving",
  APPROVED = "approved",
  DENIED = "denied",
  CONFLICT_ON_APPROVE = "conflict-on-approve",
}

/** Balance freshness at approval time */
export enum BALANCE_FRESHNESS {
  FRESH = "fresh",
  STALE = "stale",
}

export type BalanceDisplayStatus = BALANCE_DISPLAY_STATUS;
export type RequestFormStatus = REQUEST_FORM_STATUS;
export type RequestStatus = REQUEST_STATUS;
export type ApprovalCardStatus = APPROVAL_CARD_STATUS;
export type BalanceFreshness = BALANCE_FRESHNESS;

/** HCM error codes */
export enum HCM_ERROR_CODE {
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_DIMENSION = "INVALID_DIMENSION",
  CONFLICT = "CONFLICT",
  SILENT_FAILURE = "SILENT_FAILURE",
  TIMEOUT = "TIMEOUT",
  NETWORK = "NETWORK",
  UNKNOWN = "UNKNOWN",
}

export type HcmErrorCode = HCM_ERROR_CODE;
