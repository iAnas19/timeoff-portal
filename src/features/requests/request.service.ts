import { createHCMError, HCM_ERROR_CODE } from "@/shared/api/errors";
import type {
  PatchTimeOffRequestInput,
  SubmitTimeOffRequestInput,
  TimeOffRequest,
} from "@/shared/hcm/schemas";

const NOT_IMPLEMENTED = "Request service not implemented — Phase 4+";

function notImplemented(): never {
  throw createHCMError({
    code: HCM_ERROR_CODE.UNKNOWN,
    message: NOT_IMPLEMENTED,
    retryable: false,
  });
}

export async function submitTimeOffRequest(
  input: SubmitTimeOffRequestInput,
): Promise<TimeOffRequest> {
  void input;
  notImplemented();
}

export async function patchRequest(
  requestId: string,
  input: PatchTimeOffRequestInput,
): Promise<TimeOffRequest> {
  void requestId;
  void input;
  notImplemented();
}

export async function fetchEmployeeRequests(
  employeeId: string,
): Promise<TimeOffRequest[]> {
  void employeeId;
  notImplemented();
}
