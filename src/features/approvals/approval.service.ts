import { hcmGet, hcmPatch } from "@/shared/api/client";
import { REQUEST_STATUS } from "@/shared/hcm/constants";
import { HCM_API } from "@/shared/hcm/endpoints";
import {
  approveRequestInputSchema,
  denyRequestInputSchema,
  pendingApprovalsResponseSchema,
  patchTimeOffRequestInputSchema,
  timeOffRequestSchema,
  type ApproveRequestInput,
  type DenyRequestInput,
  type PendingApprovalsResponse,
  type TimeOffRequest,
} from "@/shared/hcm/schemas";

export async function fetchPendingApprovals(): Promise<PendingApprovalsResponse> {
  return hcmGet(HCM_API.APPROVAL.PENDING, pendingApprovalsResponseSchema);
}

export async function approveRequest(
  requestId: string,
  input: ApproveRequestInput,
): Promise<TimeOffRequest> {
  approveRequestInputSchema.parse(input);
  return hcmPatch(
    HCM_API.REQUEST.BY_ID(requestId),
    patchTimeOffRequestInputSchema.parse({ status: REQUEST_STATUS.APPROVED }),
    timeOffRequestSchema,
  );
}

export async function denyRequest(
  requestId: string,
  input: DenyRequestInput,
): Promise<TimeOffRequest> {
  denyRequestInputSchema.parse(input);
  return hcmPatch(
    HCM_API.REQUEST.BY_ID(requestId),
    patchTimeOffRequestInputSchema.parse({ status: REQUEST_STATUS.DENIED }),
    timeOffRequestSchema,
  );
}
