import { z } from "zod";
import { hcmGet, hcmPatch, hcmPost } from "@/shared/api/client";
import { HCM_API } from "@/shared/hcm/endpoints";
import {
  patchTimeOffRequestInputSchema,
  timeOffRequestSchema,
  type PatchTimeOffRequestInput,
  type SubmitTimeOffRequestInput,
  type TimeOffRequest,
} from "@/shared/hcm/schemas";

const requestsListSchema = z
  .object({ requests: z.array(timeOffRequestSchema) })
  .strict();

export async function submitTimeOffRequest(
  input: SubmitTimeOffRequestInput,
): Promise<TimeOffRequest> {
  return hcmPost(HCM_API.REQUEST.CREATE, input, timeOffRequestSchema);
}

export async function patchRequest(
  requestId: string,
  input: PatchTimeOffRequestInput,
): Promise<TimeOffRequest> {
  return hcmPatch(
    HCM_API.REQUEST.BY_ID(requestId),
    patchTimeOffRequestInputSchema.parse(input),
    timeOffRequestSchema,
  );
}

export async function fetchEmployeeRequests(
  employeeId: string,
): Promise<TimeOffRequest[]> {
  const { requests } = await hcmGet(HCM_API.REQUEST.LIST, requestsListSchema);
  return requests.filter((request) => request.employeeId === employeeId);
}
