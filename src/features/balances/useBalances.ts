"use client";

import { useMutationState, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  applyOptimisticDeductionToCell,
  calculateAvailableBalance,
  detectExternalConfirmedChange,
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
import type { BalanceCell, SubmitTimeOffRequestInput } from "@/shared/hcm/schemas";

export type BalanceCardState = {
  locationId: string;
  locationName: string;
  availableBalance: number;
  confirmedBalance: number;
  pendingDeductions: number;
  status: BalanceDisplayStatus;
  message?: string;
  // A background poll is in flight. This is a quiet liveness hint, NOT a status
  // change - flipping the whole card on every 30s poll reads as flicker.
  isRefreshing?: boolean;
};

const OVERLAY_STALE_TIME_MS = Number.POSITIVE_INFINITY;

function isSubmitVariables(value: unknown): value is SubmitTimeOffRequestInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "locationId" in value &&
    typeof (value as SubmitTimeOffRequestInput).locationId === "string"
  );
}

function cellToCard(
  cell: BalanceCell,
  status: BalanceDisplayStatus,
  message?: string,
): BalanceCardState {
  return {
    locationId: cell.locationId,
    locationName: cell.locationName,
    availableBalance: calculateAvailableBalance(
      cell.confirmedBalance,
      cell.pendingDeductions,
    ),
    confirmedBalance: cell.confirmedBalance,
    pendingDeductions: cell.pendingDeductions,
    status,
    message,
  };
}

export function useBalances(employeeId: string) {
  const queryClient = useQueryClient();
  const lastConfirmedRef = useRef(new Map<string, number>());

  const employeeQuery = useQuery({
    queryKey: BALANCE_KEYS.byEmployee(employeeId),
    queryFn: () => fetchEmployeeBalances(employeeId),
    staleTime: BALANCE_BATCH_STALE_TIME_MS,
  });

  const locations = useMemo(
    () => employeeQuery.data?.balances ?? [],
    [employeeQuery.data],
  );

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

  const pendingSubmits = useMutationState({
    filters: { status: "pending", mutationKey: MUTATION_KEYS.submitRequest },
  });

  const optimisticDaysByLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const mutation of pendingSubmits) {
      if (!isSubmitVariables(mutation.variables)) {
        continue;
      }
      const { locationId, days } = mutation.variables;
      map.set(locationId, (map.get(locationId) ?? 0) + days);
    }
    return map;
  }, [pendingSubmits]);

  // Authoritative poll is always truth. Because this view never mutates
  // `confirmedBalance`, any change a poll reports is an external HCM refresh
  // (e.g. anniversary bonus) - surface it as a non-intrusive banner without
  // clobbering an in-flight optimistic deduction (which is derived, not stored).
  useEffect(() => {
    locations.forEach((seed, index) => {
      const cell = cellQueries[index]?.data;
      if (!cell) {
        return;
      }

      const previousConfirmed = lastConfirmedRef.current.get(seed.locationId);
      lastConfirmedRef.current.set(seed.locationId, cell.confirmedBalance);

      if (!detectExternalConfirmedChange(previousConfirmed, cell.confirmedBalance)) {
        return;
      }

      const overlayKey = BALANCE_KEYS.overlay(employeeId, seed.locationId);
      if (queryClient.getQueryData<BalanceCardOverlay>(overlayKey)) {
        return;
      }

      queryClient.setQueryData<BalanceCardOverlay>(overlayKey, {
        status: BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION,
        message: "Balance updated by HCM while you were viewing it.",
      });
    });
  }, [cellQueries, employeeId, locations, queryClient]);

  const cards = useMemo((): BalanceCardState[] => {
    return locations.map((seed, index) => {
      const query = cellQueries[index];
      const overlay = overlayQueries[index]?.data ?? null;
      const cell = query?.data ?? seed;

      if (overlay) {
        return cellToCard(cell, overlay.status, overlay.message);
      }

      if (employeeQuery.isLoading || (query?.isLoading && !query.data)) {
        return cellToCard(
          { ...seed, confirmedBalance: 0, pendingDeductions: 0 },
          BALANCE_DISPLAY_STATUS.LOADING,
        );
      }

      if (employeeQuery.isError || query?.isError) {
        const error = employeeQuery.error ?? query?.error;
        return cellToCard(
          { ...seed, confirmedBalance: 0, pendingDeductions: 0 },
          BALANCE_DISPLAY_STATUS.ERROR,
          isHCMError(error) ? error.message : "Unable to load balance",
        );
      }

      const optimisticDays = optimisticDaysByLocation.get(seed.locationId) ?? 0;
      if (optimisticDays > 0) {
        return cellToCard(
          applyOptimisticDeductionToCell(cell, optimisticDays),
          BALANCE_DISPLAY_STATUS.OPTIMISTIC_PENDING,
          "Pending your request…",
        );
      }

      // Genuinely stale AND not currently refreshing - i.e. polling was paused
      // (tab backgrounded) and the value has aged past the poll interval. A
      // routine in-flight refetch is not "stale"; it's surfaced quietly below.
      if (query?.isStale && !query?.isFetching) {
        return cellToCard(
          cell,
          BALANCE_DISPLAY_STATUS.STALE,
          "Balance may be outdated.",
        );
      }

      return {
        ...cellToCard(cell, BALANCE_DISPLAY_STATUS.SUCCESS),
        isRefreshing: query?.isFetching ?? false,
      };
    });
  }, [
    cellQueries,
    employeeQuery.error,
    employeeQuery.isError,
    employeeQuery.isLoading,
    locations,
    optimisticDaysByLocation,
    overlayQueries,
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
