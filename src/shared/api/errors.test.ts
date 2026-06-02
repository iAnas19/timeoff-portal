import { describe, expect, it } from "vitest";
import {
  createHCMError,
  HCM_ERROR_CODE,
  isHCMError,
  parseHCMErrorBody,
} from "@/shared/api/errors";

describe("HCM error factory", () => {
  it("creates a valid HCMError with defaults", () => {
    const error = createHCMError({
      code: HCM_ERROR_CODE.INSUFFICIENT_BALANCE,
      message: "Not enough balance",
    });

    expect(error.code).toBe(HCM_ERROR_CODE.INSUFFICIENT_BALANCE);
    expect(error.retryable).toBe(false);
    expect(error.requestId.length).toBeGreaterThan(0);
    expect(isHCMError(error)).toBe(true);
  });

  it("marks timeout errors as retryable", () => {
    const error = createHCMError({
      code: HCM_ERROR_CODE.TIMEOUT,
      message: "Request timed out",
    });

    expect(error.retryable).toBe(true);
  });

  it("returns null for invalid error bodies", () => {
    expect(parseHCMErrorBody({ code: "NOT_A_REAL_CODE" })).toBeNull();
  });
});
