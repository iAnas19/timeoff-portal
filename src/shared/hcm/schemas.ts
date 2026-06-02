import { z } from "zod";
import {
  BALANCE_DISPLAY_STATUS,
  BALANCE_FRESHNESS,
  HCM_ERROR_CODE,
  REQUEST_FORM_STATUS,
  REQUEST_STATUS,
} from "@/shared/hcm/constants";

// --- Errors ---

export const hcmErrorSchema = z
  .object({
    code: z.nativeEnum(HCM_ERROR_CODE),
    message: z.string().min(1),
    requestId: z.string().min(1),
    retryable: z.boolean(),
    timestamp: z.string().datetime(),
  })
  .strict();

export type HCMError = z.infer<typeof hcmErrorSchema>;

// --- Balances ---

export const balanceCellSchema = z
  .object({
    employeeId: z.string().min(1),
    locationId: z.string().min(1),
    locationName: z.string().min(1),
    confirmedBalance: z.number().finite().nonnegative(),
    pendingDeductions: z.number().finite().nonnegative(),
    asOf: z.string().datetime(),
  })
  .strict();

export const balanceBatchResponseSchema = z
  .object({ balances: z.array(balanceCellSchema) })
  .strict();

export const employeeBalancesSchema = z
  .object({
    employeeId: z.string().min(1),
    balances: z.array(balanceCellSchema),
  })
  .strict();

export const balanceWriteInputSchema = z
  .object({
    confirmedBalance: z.number().finite().nonnegative(),
    pendingDeductions: z.number().finite().nonnegative(),
  })
  .strict();

export const balanceDisplayStatusSchema = z.nativeEnum(BALANCE_DISPLAY_STATUS);

export type BalanceCell = z.infer<typeof balanceCellSchema>;
export type BalanceBatchResponse = z.infer<typeof balanceBatchResponseSchema>;
export type EmployeeBalances = z.infer<typeof employeeBalancesSchema>;
export type BalanceWriteInput = z.infer<typeof balanceWriteInputSchema>;

// --- Requests ---

export const requestStatusSchema = z.nativeEnum(REQUEST_STATUS);
export const requestFormStatusSchema = z.nativeEnum(REQUEST_FORM_STATUS);

export const timeOffRequestSchema = z
  .object({
    id: z.string().min(1),
    employeeId: z.string().min(1),
    locationId: z.string().min(1),
    days: z.number().finite().positive(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    status: requestStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const submitTimeOffRequestInputSchema = z
  .object({
    employeeId: z.string().min(1),
    locationId: z.string().min(1),
    days: z.number().finite().positive(),
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .strict();

export const patchTimeOffRequestInputSchema = z
  .object({ status: requestStatusSchema })
  .strict();

export type TimeOffRequest = z.infer<typeof timeOffRequestSchema>;
export type SubmitTimeOffRequestInput = z.infer<
  typeof submitTimeOffRequestInputSchema
>;
export type PatchTimeOffRequestInput = z.infer<
  typeof patchTimeOffRequestInputSchema
>;

// --- Approvals ---

export const balanceFreshnessSchema = z.nativeEnum(BALANCE_FRESHNESS);

export const pendingApprovalSchema = z
  .object({
    request: timeOffRequestSchema,
    employeeDisplayName: z.string().min(1),
    locationName: z.string().min(1),
    balanceAtQueueTime: balanceCellSchema,
    balanceFreshness: balanceFreshnessSchema,
  })
  .strict();

export const pendingApprovalsResponseSchema = z
  .object({ approvals: z.array(pendingApprovalSchema) })
  .strict();

export const approveRequestInputSchema = z.object({}).strict();

export const denyRequestInputSchema = z
  .object({ reason: z.string().min(1).max(500).optional() })
  .strict();

export type PendingApproval = z.infer<typeof pendingApprovalSchema>;
export type PendingApprovalsResponse = z.infer<
  typeof pendingApprovalsResponseSchema
>;
export type ApproveRequestInput = z.infer<typeof approveRequestInputSchema>;
export type DenyRequestInput = z.infer<typeof denyRequestInputSchema>;
