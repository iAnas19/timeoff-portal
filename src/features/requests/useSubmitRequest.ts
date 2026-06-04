"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { setBalanceOverlay } from "@/features/balances/useBalances";
import { fetchEmployeeBalances } from "@/features/balances/balance.service";
import {
  fetchEmployeeRequests,
  submitTimeOffRequest,
} from "@/features/requests/request.service";
import { HCM_ERROR_CODE, isHCMError } from "@/shared/api/errors";
import {
  BALANCE_BATCH_STALE_TIME_MS,
  BALANCE_DISPLAY_STATUS,
  MAX_REQUEST_DAYS,
  MIN_REQUEST_DAYS,
  REQUEST_FORM_STATUS,
  REQUEST_STATUS,
} from "@/shared/hcm/constants";
import { BALANCE_KEYS, MUTATION_KEYS, REQUEST_KEYS } from "@/shared/hcm/queryKeys";
import {
  submitTimeOffRequestInputSchema,
  type SubmitTimeOffRequestInput,
  type TimeOffRequest,
} from "@/shared/hcm/schemas";
import type { RequestFormStatus } from "@/shared/hcm/constants";

// Name the cause so "rolled back" tells the user *why*, not just "it failed".
// INSUFFICIENT/INVALID/CONFLICT already carry a specific server message
// (CONFLICT covers both write-conflicts and duplicate-date bookings).
//
// For TIMEOUT/NETWORK we deliberately do NOT claim "nothing changed": a
// non-idempotent write that the client gave up on may have landed server-side.
// The honest, recoverable framing is "we couldn't confirm" - and onSettled then
// reconciles against the source of truth and upgrades to success if it did land.
function rollbackMessage(error: unknown): string {
  if (isHCMError(error)) {
    if (error.code === HCM_ERROR_CODE.TIMEOUT) {
      return "We couldn't confirm your request with the HR system in time. We've refreshed your balance below - please review it before retrying.";
    }
    if (error.code === HCM_ERROR_CODE.NETWORK) {
      return "We couldn't reach the HR system. We've refreshed your balance below - please review it before retrying.";
    }
    return error.message;
  }
  return "Something went wrong and your request didn't go through. Your balance is unchanged.";
}

// A timeout/network failure is AMBIGUOUS: the write may or may not have reached
// HCM. Explicit HCM rejections (insufficient/invalid/conflict) are unambiguous -
// the server told us it did not persist.
function isAmbiguousWriteError(error: unknown): boolean {
  return (
    isHCMError(error) &&
    (error.code === HCM_ERROR_CODE.TIMEOUT ||
      error.code === HCM_ERROR_CODE.NETWORK)
  );
}

/**
 * Did THIS specific submit actually land in HCM? We reconcile against the
 * authoritative request list rather than diffing the aggregate `pendingDeductions`
 * number. Two reasons:
 *   1. Concurrency-safe: a second in-flight submit for the same cell also bumps
 *      pending, so an aggregate diff would falsely flag the first as a silent
 *      conflict. Checking for our own request id/row never confuses the two.
 *   2. Honest under timeout: a write the client abandoned may still have persisted;
 *      finding our row proves it landed so we can recover instead of lying.
 *
 * Success/silent-fail path: the 200 body gives us the request id to look up.
 * Timeout/network path: there is no body, so match on the submitted dimensions.
 */
async function didRequestLand(
  variables: SubmitTimeOffRequestInput,
  data: TimeOffRequest | undefined,
  error: unknown,
): Promise<boolean> {
  try {
    const requests = await fetchEmployeeRequests(variables.employeeId);
    if (data?.id) {
      return requests.some((request) => request.id === data.id);
    }
    return requests.some(
      (request) =>
        request.locationId === variables.locationId &&
        request.startDate === variables.startDate &&
        request.endDate === variables.endDate &&
        request.status === REQUEST_STATUS.PENDING,
    );
  } catch {
    // If we can't even read the source of truth, fall back to the HTTP outcome.
    return !error && Boolean(data);
  }
}

export function useSubmitRequest(employeeId: string) {
  const queryClient = useQueryClient();
  const [formStatus, setFormStatus] = useState<RequestFormStatus>(
    REQUEST_FORM_STATUS.IDLE,
  );
  const [statusMessage, setStatusMessage] = useState<string>();

  const locationsQuery = useQuery({
    queryKey: BALANCE_KEYS.byEmployee(employeeId),
    queryFn: () => fetchEmployeeBalances(employeeId),
    staleTime: BALANCE_BATCH_STALE_TIME_MS,
  });

  const mutation = useMutation({
    mutationKey: MUTATION_KEYS.submitRequest,
    mutationFn: submitTimeOffRequest,
    onMutate: async (variables) => {
      // We do NOT write the optimistic value into the cache - the deduction is
      // derived in useBalances from the pending mutation, so a concurrent poll
      // can never clobber it. Cancel in-flight cell fetches so a poll landing
      // mid-mutation doesn't race the reconciliation below.
      const cellKey = BALANCE_KEYS.byEmployeeAndLocation(
        variables.employeeId,
        variables.locationId,
      );
      await queryClient.cancelQueries({ queryKey: cellKey });

      // Clean slate: drop any banner from a prior attempt so a retry starts fresh.
      setBalanceOverlay(
        queryClient,
        variables.employeeId,
        variables.locationId,
        null,
      );
    },
    onError: (error, variables) => {
      const message = rollbackMessage(error);

      setBalanceOverlay(
        queryClient,
        variables.employeeId,
        variables.locationId,
        { status: BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK, message },
      );

      if (
        isHCMError(error) &&
        (error.code === HCM_ERROR_CODE.INSUFFICIENT_BALANCE ||
          error.code === HCM_ERROR_CODE.INVALID_DIMENSION)
      ) {
        setFormStatus(REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED);
      } else {
        // Includes CONFLICT (terminal) and TIMEOUT/NETWORK (provisional - may be
        // upgraded to success by onSettled if reconciliation proves it landed).
        setFormStatus(REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK);
      }

      setStatusMessage(message);
    },
    onSettled: async (data, error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: BALANCE_KEYS.byEmployee(variables.employeeId),
      });
      await queryClient.invalidateQueries({
        queryKey: REQUEST_KEYS.byEmployee(variables.employeeId),
      });

      // Only the success path and the ambiguous timeout/network path need to ask
      // the source of truth what really happened. An explicit HCM rejection has
      // already been surfaced accurately by onError - nothing persisted.
      const needsReconcile = !error || isAmbiguousWriteError(error);
      if (!needsReconcile) {
        return;
      }

      const landed = await didRequestLand(variables, data, error);

      if (error) {
        // Ambiguous failure. If the write actually reached HCM despite the
        // client giving up, say so honestly and clear the rolled-back banner -
        // a late contradiction that is recoverable, not a lie.
        if (landed) {
          setBalanceOverlay(
            queryClient,
            variables.employeeId,
            variables.locationId,
            null,
          );
          setFormStatus(REQUEST_FORM_STATUS.SUBMIT_SUCCESS);
          setStatusMessage(
            "Your request reached the HR system despite a slow response. Your balance has been updated.",
          );
        }
        // Otherwise the rolled-back state from onError is accurate; leave it.
        return;
      }

      if (!landed) {
        // HTTP 200 but our request is not in HCM -> silent failure.
        setFormStatus(REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT);
        setStatusMessage(
          "Request accepted but balance did not update. Verify before resubmitting.",
        );
        setBalanceOverlay(
          queryClient,
          variables.employeeId,
          variables.locationId,
          {
            status: BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT,
            message:
              "HCM accepted the request but balance did not change. Verify before resubmitting.",
          },
        );
        return;
      }

      setFormStatus(REQUEST_FORM_STATUS.SUBMIT_SUCCESS);
      setStatusMessage("Request submitted and balance reconciled.");
    },
  });

  const resetForm = useCallback(() => {
    setFormStatus(REQUEST_FORM_STATUS.IDLE);
    setStatusMessage(undefined);
  }, []);

  const submit = useCallback(
    (raw: Omit<SubmitTimeOffRequestInput, "employeeId">) => {
      setFormStatus(REQUEST_FORM_STATUS.VALIDATING);
      setStatusMessage(undefined);

      const parsed = submitTimeOffRequestInputSchema.safeParse({
        ...raw,
        employeeId,
        days: Number(raw.days),
      });

      if (!parsed.success) {
        setFormStatus(REQUEST_FORM_STATUS.IDLE);
        setStatusMessage(parsed.error.issues[0]?.message ?? "Invalid form input");
        return;
      }

      if (
        parsed.data.days < MIN_REQUEST_DAYS ||
        parsed.data.days > MAX_REQUEST_DAYS
      ) {
        setFormStatus(REQUEST_FORM_STATUS.IDLE);
        setStatusMessage(
          `Days must be between ${MIN_REQUEST_DAYS} and ${MAX_REQUEST_DAYS}.`,
        );
        return;
      }

      setFormStatus(REQUEST_FORM_STATUS.SUBMITTING);
      mutation.mutate(parsed.data);
    },
    [employeeId, mutation],
  );

  return {
    formStatus,
    statusMessage,
    locations: locationsQuery.data?.balances ?? [],
    submit,
    resetForm,
    isSubmitting: mutation.isPending,
    minDays: MIN_REQUEST_DAYS,
    maxDays: MAX_REQUEST_DAYS,
  };
}
