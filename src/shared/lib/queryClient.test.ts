import { describe, expect, it } from "vitest";
import { createQueryClient } from "@/shared/lib/queryClient";
import { createHCMError, HCM_ERROR_CODE } from "@/shared/api/errors";

describe("createQueryClient retry policy", () => {
  const options = createQueryClient().getDefaultOptions();

  it("never auto-retries mutations (a timed-out non-idempotent write must not duplicate)", () => {
    // Regression guard: retrying a POST/PATCH that may have already succeeded
    // server-side would create duplicates (e.g. two manager entries from one
    // slow submit). Mutations must surface the failure for a manual retry.
    expect(options.mutations?.retry).toBe(false);
  });

  it("retries idempotent reads only on retryable errors, up to the cap", () => {
    const retry = options.queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    const retryable = createHCMError({
      code: HCM_ERROR_CODE.TIMEOUT,
      message: "timed out",
      retryable: true,
    });
    const fatal = createHCMError({
      code: HCM_ERROR_CODE.INSUFFICIENT_BALANCE,
      message: "no",
      retryable: false,
    });

    expect(retry(0, retryable)).toBe(true);
    expect(retry(0, fatal)).toBe(false);
    expect(retry(99, retryable)).toBe(false); // past the retry cap
    expect(retry(0, new Error("non-hcm"))).toBe(false);
  });
});
