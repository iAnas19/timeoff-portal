import { nanoid } from "nanoid";
import { HCM_ERROR_CODE } from "@/shared/hcm/constants";
import { hcmErrorSchema, type HCMError } from "@/shared/hcm/schemas";

const RETRYABLE_CODES = new Set<HCM_ERROR_CODE>([
  HCM_ERROR_CODE.TIMEOUT,
  HCM_ERROR_CODE.NETWORK,
]);

type CreateHCMErrorInput = {
  code: HCM_ERROR_CODE;
  message: string;
  requestId?: string;
  retryable?: boolean;
  timestamp?: string;
};

export function createHCMError(input: CreateHCMErrorInput): HCMError {
  return hcmErrorSchema.parse({
    code: input.code,
    message: input.message,
    requestId: input.requestId ?? nanoid(),
    retryable: input.retryable ?? RETRYABLE_CODES.has(input.code),
    timestamp: input.timestamp ?? new Date().toISOString(),
  });
}

export function isHCMError(value: unknown): value is HCMError {
  return hcmErrorSchema.safeParse(value).success;
}

export function parseHCMErrorBody(body: unknown): HCMError | null {
  const result = hcmErrorSchema.safeParse(body);
  return result.success ? result.data : null;
}

export type { HCMError };
export { HCM_ERROR_CODE };
