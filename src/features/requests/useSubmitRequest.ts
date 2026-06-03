"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { setBalanceOverlay } from "@/features/balances/useBalances";
import { fetchEmployeeBalances } from "@/features/balances/balance.service";
import { balancesAreEqual } from "@/features/balances/balance.utils";
import { submitTimeOffRequest } from "@/features/requests/request.service";
import { HCM_ERROR_CODE, isHCMError } from "@/shared/api/errors";
import {
  BALANCE_BATCH_STALE_TIME_MS,
  BALANCE_DISPLAY_STATUS,
  MAX_REQUEST_DAYS,
  MIN_REQUEST_DAYS,
  REQUEST_FORM_STATUS,
} from "@/shared/hcm/constants";
import { BALANCE_KEYS, MUTATION_KEYS, REQUEST_KEYS } from "@/shared/hcm/queryKeys";
import {
  submitTimeOffRequestInputSchema,
  type BalanceCell,
  type SubmitTimeOffRequestInput,
} from "@/shared/hcm/schemas";
import type { RequestFormStatus } from "@/shared/hcm/constants";

type SubmitContext = {
  previousCell: BalanceCell | undefined;
  cellKey: ReturnType<typeof BALANCE_KEYS.byEmployeeAndLocation>;
};

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
    onMutate: async (variables): Promise<SubmitContext> => {
      // Snapshot the pre-mutation cell so onSettled can reconcile against it.
      // We do NOT write the optimistic value into the cache — the deduction is
      // derived in useBalances from the pending mutation, so a concurrent poll
      // can never clobber it.
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

      return {
        previousCell: queryClient.getQueryData<BalanceCell>(cellKey),
        cellKey,
      };
    },
    onError: (error, variables) => {
      setBalanceOverlay(
        queryClient,
        variables.employeeId,
        variables.locationId,
        {
          status: BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK,
          message: "Your request did not apply. Balance restored.",
        },
      );

      if (
        isHCMError(error) &&
        (error.code === HCM_ERROR_CODE.INSUFFICIENT_BALANCE ||
          error.code === HCM_ERROR_CODE.INVALID_DIMENSION)
      ) {
        setFormStatus(REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED);
      } else {
        setFormStatus(REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK);
      }

      setStatusMessage(
        isHCMError(error) ? error.message : "Request failed. Try again.",
      );
    },
    onSettled: async (_data, error, variables, context) => {
      await queryClient.invalidateQueries({
        queryKey: BALANCE_KEYS.byEmployee(variables.employeeId),
      });
      await queryClient.invalidateQueries({
        queryKey: REQUEST_KEYS.byEmployee(variables.employeeId),
      });

      if (error || !context?.previousCell) {
        return;
      }

      const refreshed = queryClient.getQueryData<BalanceCell>(context.cellKey);
      if (!refreshed) {
        return;
      }

      const expectedPending =
        context.previousCell.pendingDeductions + variables.days;

      if (!balancesAreEqual(refreshed.pendingDeductions, expectedPending)) {
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
