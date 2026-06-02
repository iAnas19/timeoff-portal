import { createHCMError, HCM_ERROR_CODE } from "@/shared/api/errors";
import type {
  ApproveRequestInput,
  DenyRequestInput,
  PendingApprovalsResponse,
  TimeOffRequest,
} from "@/shared/hcm/schemas";

const NOT_IMPLEMENTED = "Approval service not implemented — Phase 4+";

function notImplemented(): never {
  throw createHCMError({
    code: HCM_ERROR_CODE.UNKNOWN,
    message: NOT_IMPLEMENTED,
    retryable: false,
  });
}

export async function fetchPendingApprovals(): Promise<PendingApprovalsResponse> {
  notImplemented();
}

export async function approveRequest(
  requestId: string,
  input: ApproveRequestInput,
): Promise<TimeOffRequest> {
  void requestId;
  void input;
  notImplemented();
}

export async function denyRequest(
  requestId: string,
  input: DenyRequestInput,
): Promise<TimeOffRequest> {
  void requestId;
  void input;
  notImplemented();
}
