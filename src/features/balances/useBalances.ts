"use client";

import {
  useMutationState,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  applyOptimisticDeduction,
  balancesAreEqual,
  calculateAvailableBalance,
  shouldBufferPollResult,
  shouldShowRefreshedMidSession,
} from "@/features/balances/balance.utils";
import {
  fetchBalance,
  fetchEmployeeBalances,
} from "@/features/balances/balance.service";
import { isHCMError } from "@/shared/api/errors";
import {
  BALANCE_BATCH_STALE_TIME_MS,
  BALANCE_CELL_STALE_TIME_MS,
  BALANCE_DISPLAY_STATUS,
  BALANCE_POLL_INTERVAL_MS,
} from "@/shared/hcm/constants";
import {
  BALANCE_KEYS,
  MUTATION_KEYS,
  type BalanceCardOverlay,
} from "@/shared/hcm/queryKeys";
import type { BalanceDisplayStatus } from "@/shared/hcm/constants";
import type { BalanceCell, EmployeeBalances, SubmitTimeOffRequestInput } from "@/shared/hcm/schemas";

export type BalanceCardState = {
  locationId: string;
  locationName: string;
  availableBalance: number;
  confirmedBalance: number;
  pendingDeductions: number;
  status: BalanceDisplayStatus;
  message?: string;
};

const OVERLAY_STALE_TIME_MS = Number.POSITIVE_INFINITY;

function isSubmitVariables(
  value: unknown,
): value is SubmitTimeOffRequestInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "locationId" in value &&
    typeof (value as SubmitTimeOffRequestInput).locationId === "string"
  );
}

export function useBalances(employeeId: string) {
  const queryClient = useQueryClient();
  const bufferRef = useRef(new Map<string, BalanceCell>());
  const hadBufferRef = useRef(new Map<string, boolean>());
  const baselineRef = useRef(new Map<string, number>());

  const employeeQuery = useQuery({
    queryKey: BALANCE_KEYS.byEmployee(employeeId),
    queryFn: () => fetchEmployeeBalances(employeeId),
    staleTime: BALANCE_BATCH_STALE_TIME_MS,
  });

  const locations = employeeQuery.data?.balances ?? [];

  const cellQueries = useQueries({
    queries: locations.map((seed) => ({
      queryKey: BALANCE_KEYS.byEmployeeAndLocation(employeeId, seed.locationId),
      queryFn: () => fetchBalance(employeeId, seed.locationId),
      staleTime: BALANCE_CELL_STALE_TIME_MS,
      refetchInterval: BALANCE_POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
      enabled: employeeQuery.isSuccess,
      initialData: seed,
    })),
  });

  const overlayQueries = useQueries({
    queries: locations.map((seed) => ({
      queryKey: BALANCE_KEYS.overlay(employeeId, seed.locationId),
      queryFn: async (): Promise<BalanceCardOverlay | null> => null,
      initialData: null as BalanceCardOverlay | null,
      staleTime: OVERLAY_STALE_TIME_MS,
    })),
  });

  const pendingMutations = useMutationState({
    filters: {
      status: "pending",
      mutationKey: MUTATION_KEYS.submitRequest,
    },
  });

  const submitMutations = useMutationState({
    filters: { mutationKey: MUTATION_KEYS.submitRequest },
  });

  const isMutationPending = pendingMutations.length > 0;

  useEffect(() => {
    for (const mutation of pendingMutations) {
      if (!isSubmitVariables(mutation.variables)) {
        continue;
      }

      const { locationId } = mutation.variables;
      if (baselineRef.current.has(locationId)) {
        continue;
      }

      const cell = queryClient.getQueryData<BalanceCell>(
        BALANCE_KEYS.byEmployeeAndLocation(employeeId, locationId),
      );
      if (cell) {
        baselineRef.current.set(locationId, cell.confirmedBalance);
      }
    }
  }, [employeeId, pendingMutations, queryClient]);

  useEffect(() => {
    locations.forEach((seed, index) => {
      const polled = cellQueries[index]?.data;
      if (!polled) {
        return;
      }

      const locationId = seed.locationId;
      const displayed = queryClient.getQueryData<BalanceCell>(
        BALANCE_KEYS.byEmployeeAndLocation(employeeId, locationId),
      );
      if (!displayed) {
        return;
      }

      if (
        shouldBufferPollResult({
          isMutationPending,
          polledConfirmedBalance: polled.confirmedBalance,
          displayedConfirmedBalance: displayed.confirmedBalance,
        })
      ) {
        bufferRef.current.set(locationId, polled);
        hadBufferRef.current.set(locationId, true);
        return;
      }

      if (isMutationPending || !bufferRef.current.has(locationId)) {
        return;
      }

      const buffered = bufferRef.current.get(locationId)!;
      const baseline =
        baselineRef.current.get(locationId) ?? displayed.confirmedBalance;

      queryClient.setQueryData(
        BALANCE_KEYS.byEmployeeAndLocation(employeeId, locationId),
        buffered,
      );

      if (
        shouldShowRefreshedMidSession({
          baselineConfirmedBalance: baseline,
          settledConfirmedBalance: buffered.confirmedBalance,
          hadBufferedPoll: hadBufferRef.current.get(locationId) ?? false,
        })
      ) {
        queryClient.setQueryData<BalanceCardOverlay>(
          BALANCE_KEYS.overlay(employeeId, locationId),
          {
            status: BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION,
            message: "Balance updated while your request was processing.",
          },
        );
      }

      bufferRef.current.delete(locationId);
      hadBufferRef.current.delete(locationId);
      baselineRef.current.delete(locationId);
    });
  }, [cellQueries, employeeId, isMutationPending, locations, queryClient]);

  const cards = useMemo((): BalanceCardState[] => {
    return locations.map((seed, index) => {
      const query = cellQueries[index];
      const overlay = overlayQueries[index]?.data ?? null;
      const locationId = seed.locationId;

      if (overlay) {
        const cell = query?.data ?? seed;
        return {
          locationId,
          locationName: cell.locationName,
          availableBalance: calculateAvailableBalance(
            cell.confirmedBalance,
            cell.pendingDeductions,
          ),
          confirmedBalance: cell.confirmedBalance,
          pendingDeductions: cell.pendingDeductions,
          status: overlay.status,
          message: overlay.message,
        };
      }

      if (employeeQuery.isLoading || (query?.isLoading && !query.data)) {
        return {
          locationId,
          locationName: seed.locationName,
          availableBalance: 0,
          confirmedBalance: 0,
          pendingDeductions: 0,
          status: BALANCE_DISPLAY_STATUS.LOADING,
        };
      }

      if (employeeQuery.isError || query?.isError) {
        const error = employeeQuery.error ?? query?.error;
        return {
          locationId,
          locationName: seed.locationName,
          availableBalance: 0,
          confirmedBalance: 0,
          pendingDeductions: 0,
          status: BALANCE_DISPLAY_STATUS.ERROR,
          message: isHCMError(error)
            ? error.message
            : "Unable to load balance",
        };
      }

      const cell = query?.data ?? seed;
      const failedMutation = submitMutations.find(
        (mutation) =>
          mutation.status === "error" &&
          isSubmitVariables(mutation.variables) &&
          mutation.variables.locationId === locationId,
      );

      if (failedMutation) {
        return {
          locationId,
          locationName: cell.locationName,
          availableBalance: calculateAvailableBalance(
            cell.confirmedBalance,
            cell.pendingDeductions,
          ),
          confirmedBalance: cell.confirmedBalance,
          pendingDeductions: cell.pendingDeductions,
          status: BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK,
          message: "Your last action did not apply. Balance restored.",
        };
      }

      const pendingForLocation = pendingMutations.some(
        (mutation) =>
          isSubmitVariables(mutation.variables) &&
          mutation.variables.locationId === locationId,
      );

      const optimisticCell = queryClient.getQueryData<BalanceCell>(
        BALANCE_KEYS.byEmployeeAndLocation(employeeId, locationId),
      );
      const showOptimistic =
        pendingForLocation ||
        (optimisticCell !== undefined &&
          !balancesAreEqual(
            optimisticCell.pendingDeductions,
            cell.pendingDeductions,
          ));

      if (showOptimistic) {
        const displayCell = optimisticCell ?? cell;
        return {
          locationId,
          locationName: displayCell.locationName,
          availableBalance: calculateAvailableBalance(
            displayCell.confirmedBalance,
            displayCell.pendingDeductions,
          ),
          confirmedBalance: displayCell.confirmedBalance,
          pendingDeductions: displayCell.pendingDeductions,
          status: BALANCE_DISPLAY_STATUS.OPTIMISTIC_PENDING,
          message: "Pending your request…",
        };
      }

      if (query?.isStale) {
        return {
          locationId,
          locationName: cell.locationName,
          availableBalance: calculateAvailableBalance(
            cell.confirmedBalance,
            cell.pendingDeductions,
          ),
          confirmedBalance: cell.confirmedBalance,
          pendingDeductions: cell.pendingDeductions,
          status: BALANCE_DISPLAY_STATUS.STALE,
          message: "Balance may be outdated.",
        };
      }

      return {
        locationId,
        locationName: cell.locationName,
        availableBalance: calculateAvailableBalance(
          cell.confirmedBalance,
          cell.pendingDeductions,
        ),
        confirmedBalance: cell.confirmedBalance,
        pendingDeductions: cell.pendingDeductions,
        status: BALANCE_DISPLAY_STATUS.SUCCESS,
      };
    });
  }, [
    cellQueries,
    employeeId,
    employeeQuery.error,
    employeeQuery.isError,
    employeeQuery.isLoading,
    locations,
    overlayQueries,
    pendingMutations,
    queryClient,
    submitMutations,
  ]);

  function clearOverlay(locationId: string) {
    queryClient.setQueryData(BALANCE_KEYS.overlay(employeeId, locationId), null);
  }

  return {
    cards,
    isLoading: employeeQuery.isLoading,
    error: employeeQuery.error,
    refetch: employeeQuery.refetch,
    clearOverlay,
  };
}

export function setBalanceOverlay(
  queryClient: ReturnType<typeof useQueryClient>,
  employeeId: string,
  locationId: string,
  overlay: BalanceCardOverlay | null,
) {
  queryClient.setQueryData(
    BALANCE_KEYS.overlay(employeeId, locationId),
    overlay,
  );
}

export function applySubmitOptimisticUpdate(
  queryClient: ReturnType<typeof useQueryClient>,
  input: SubmitTimeOffRequestInput,
) {
  const employeeKey = BALANCE_KEYS.byEmployee(input.employeeId);
  const cellKey = BALANCE_KEYS.byEmployeeAndLocation(
    input.employeeId,
    input.locationId,
  );

  const previousEmployee = queryClient.getQueryData(employeeKey);
  const previousCell = queryClient.getQueryData<BalanceCell>(cellKey);

  queryClient.setQueryData<EmployeeBalances | undefined>(employeeKey, (current) =>
    applyOptimisticDeduction(current, input),
  );

  const updatedEmployee = queryClient.getQueryData<{
    balances: BalanceCell[];
  }>(employeeKey);
  const updatedCell = updatedEmployee?.balances.find(
    (cell) => cell.locationId === input.locationId,
  );

  if (updatedCell) {
    queryClient.setQueryData(cellKey, updatedCell);
  }

  return { previousEmployee, previousCell, employeeKey, cellKey };
}
