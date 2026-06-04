"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  approveRequest,
  denyRequest,
  fetchPendingApprovals,
} from "@/features/approvals/approval.service";
import { fetchBalance } from "@/features/balances/balance.service";
import { balancesAreEqual } from "@/features/balances/balance.utils";
import { HCM_ERROR_CODE, isHCMError } from "@/shared/api/errors";
import {
  APPROVAL_CARD_STATUS,
  BALANCE_CELL_STALE_TIME_MS,
  BALANCE_FRESHNESS,
  BALANCE_POLL_INTERVAL_MS,
  REQUEST_LIST_STALE_TIME_MS,
} from "@/shared/hcm/constants";
import {
  APPROVAL_KEYS,
  BALANCE_KEYS,
  MUTATION_KEYS,
} from "@/shared/hcm/queryKeys";
import type { ApprovalCardStatus } from "@/shared/hcm/constants";
import type { PendingApproval } from "@/shared/hcm/schemas";

export type ApprovalCardState = {
  approval: PendingApproval;
  status: ApprovalCardStatus;
  liveAvailableBalance: number | null;
  message?: string;
};

export function useApprovals() {
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: APPROVAL_KEYS.pending(),
    queryFn: fetchPendingApprovals,
    staleTime: REQUEST_LIST_STALE_TIME_MS,
  });

  const approvals = useMemo(
    () => queueQuery.data?.approvals ?? [],
    [queueQuery.data],
  );

  const liveBalanceQueries = useQueries({
    queries: approvals.map((approval) => ({
      queryKey: BALANCE_KEYS.byEmployeeAndLocation(
        approval.request.employeeId,
        approval.request.locationId,
      ),
      queryFn: () =>
        fetchBalance(
          approval.request.employeeId,
          approval.request.locationId,
        ),
      staleTime: BALANCE_CELL_STALE_TIME_MS,
      // Keep the manager's balance context valid at decision time, not minutes old.
      refetchInterval: BALANCE_POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
      enabled: queueQuery.isSuccess,
    })),
  });

  const approveMutation = useMutation({
    mutationKey: MUTATION_KEYS.approveRequest,
    mutationFn: (requestId: string) => approveRequest(requestId, {}),
    onSettled: async (_data, _error, requestId) => {
      const approval = approvals.find((item) => item.request.id === requestId);
      await queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.pending() });
      if (approval) {
        await queryClient.invalidateQueries({
          queryKey: BALANCE_KEYS.byEmployee(approval.request.employeeId),
        });
      }
    },
  });

  const denyMutation = useMutation({
    mutationKey: MUTATION_KEYS.denyRequest,
    mutationFn: (requestId: string) => denyRequest(requestId, {}),
    onSettled: async (_data, _error, requestId) => {
      const approval = approvals.find((item) => item.request.id === requestId);
      await queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.pending() });
      if (approval) {
        await queryClient.invalidateQueries({
          queryKey: BALANCE_KEYS.byEmployee(approval.request.employeeId),
        });
      }
    },
  });

  const cards = useMemo((): ApprovalCardState[] => {
    return approvals.map((approval, index) => {
      const requestId = approval.request.id;
      const liveCell = liveBalanceQueries[index]?.data;
      const liveAvailableBalance = liveCell
        ? Math.max(0, liveCell.confirmedBalance - liveCell.pendingDeductions)
        : null;

      const isApproving =
        approveMutation.isPending &&
        approveMutation.variables === requestId;
      const isDenying =
        denyMutation.isPending && denyMutation.variables === requestId;

      if (isApproving || isDenying) {
        return {
          approval,
          status: APPROVAL_CARD_STATUS.APPROVING,
          liveAvailableBalance,
          message: isApproving ? "Approving…" : "Denying…",
        };
      }

      const approveError =
        approveMutation.isError &&
        approveMutation.variables === requestId &&
        approveMutation.error;
      const denyError =
        denyMutation.isError &&
        denyMutation.variables === requestId &&
        denyMutation.error;
      const decisionError = approveError ?? denyError;

      // Surface ANY HCM rejection, not just write-conflicts. INSUFFICIENT_BALANCE
      // (the balance fell below the request between queue time and approval) used
      // to fall through to a plain "pending" card with no message - the manager
      // had no idea why nothing happened. Conflict gets its own state; everything
      // else surfaces as REJECTED_ON_APPROVE with the HCM reason, buttons enabled
      // so the manager can re-evaluate.
      if (decisionError && isHCMError(decisionError)) {
        return {
          approval,
          status:
            decisionError.code === HCM_ERROR_CODE.CONFLICT
              ? APPROVAL_CARD_STATUS.CONFLICT_ON_APPROVE
              : APPROVAL_CARD_STATUS.REJECTED_ON_APPROVE,
          liveAvailableBalance,
          message: decisionError.message,
        };
      }

      if (
        approveMutation.isSuccess &&
        approveMutation.variables === requestId
      ) {
        return {
          approval,
          status: APPROVAL_CARD_STATUS.APPROVED,
          liveAvailableBalance,
        };
      }

      if (denyMutation.isSuccess && denyMutation.variables === requestId) {
        return {
          approval,
          status: APPROVAL_CARD_STATUS.DENIED,
          liveAvailableBalance,
        };
      }

      const isFresh =
        liveCell &&
        balancesAreEqual(
          liveCell.confirmedBalance,
          approval.balanceAtQueueTime.confirmedBalance,
        ) &&
        balancesAreEqual(
          liveCell.pendingDeductions,
          approval.balanceAtQueueTime.pendingDeductions,
        );

      return {
        approval,
        status: isFresh
          ? APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE
          : APPROVAL_CARD_STATUS.PENDING_STALE_BALANCE,
        liveAvailableBalance,
        message: isFresh
          ? undefined
          : "Live balance differs from when this was queued.",
      };
    });
  }, [
    approvals,
    approveMutation.error,
    approveMutation.isError,
    approveMutation.isPending,
    approveMutation.isSuccess,
    approveMutation.variables,
    denyMutation.error,
    denyMutation.isError,
    denyMutation.isPending,
    denyMutation.isSuccess,
    denyMutation.variables,
    liveBalanceQueries,
  ]);

  const approve = useCallback(
    (requestId: string) => {
      approveMutation.reset();
      denyMutation.reset();
      approveMutation.mutate(requestId);
    },
    [approveMutation, denyMutation],
  );

  const deny = useCallback(
    (requestId: string) => {
      approveMutation.reset();
      denyMutation.reset();
      denyMutation.mutate(requestId);
    },
    [approveMutation, denyMutation],
  );

  return {
    cards,
    isLoading: queueQuery.isLoading,
    error: queueQuery.error,
    approve,
    deny,
    refetch: queueQuery.refetch,
  };
}

export { BALANCE_FRESHNESS };
