"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BalanceCardState } from "@/features/balances/useBalances";
import { useBalances } from "@/features/balances/useBalances";
import {
  armConflictScenario,
  armSilentFailScenario,
  simulateAnniversary,
} from "@/features/balances/balance.service";
import { BALANCE_DISPLAY_STATUS } from "@/shared/hcm/constants";
import { BALANCE_KEYS } from "@/shared/hcm/queryKeys";
import { Alert, Badge, Banner, Button, Card, Spinner } from "@/shared/ui";
import type { BalanceDisplayStatus } from "@/shared/hcm/constants";

export type BalanceCardProps = BalanceCardState & {
  onDismissOverlay?: () => void;
};

export function BalanceCard({
  locationName,
  availableBalance,
  confirmedBalance,
  pendingDeductions,
  status,
  message,
  isRefreshing,
  onDismissOverlay,
}: BalanceCardProps) {
  const showOverlayBanner =
    status === BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION ||
    status === BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT ||
    status === BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK;

  return (
    <Card className="balance-card">
      <div className="balance-card-header">
        <div>
          <span className="balance-card-eyebrow">Balance</span>
          <h3 className="balance-card-title">{locationName}</h3>
        </div>
        <div className="balance-card-status">
          {isRefreshing && status === BALANCE_DISPLAY_STATUS.SUCCESS ? (
            <span className="balance-refreshing" aria-label="Refreshing balance">
              Updating
            </span>
          ) : null}
          <Badge className={badgeTone(status)}>{statusLabel(status)}</Badge>
        </div>
      </div>

      {status === BALANCE_DISPLAY_STATUS.LOADING ? (
        <div className="balance-card-loading">
          <Spinner />
          <span>Loading balance…</span>
        </div>
      ) : status === BALANCE_DISPLAY_STATUS.ERROR ? (
        <Alert role="alert">{message ?? "Unable to load balance."}</Alert>
      ) : (
        <>
          <p className="balance-available">
            <span className="balance-available-value">{availableBalance}</span>
            <span className="balance-available-label">days available</span>
          </p>
          <dl className="balance-meta">
            <div>
              <dt>Confirmed</dt>
              <dd>{confirmedBalance}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{pendingDeductions}</dd>
            </div>
          </dl>
        </>
      )}

      {status === BALANCE_DISPLAY_STATUS.STALE && message ? (
        <p className="balance-note balance-note-muted">{message}</p>
      ) : null}

      {status === BALANCE_DISPLAY_STATUS.OPTIMISTIC_PENDING && message ? (
        <p className="balance-note balance-note-pending">{message}</p>
      ) : null}

      {showOverlayBanner && message ? (
        <Banner className="balance-banner">
          {message}
          {onDismissOverlay ? (
            <Button
              variant="secondary"
              className="balance-dismiss"
              onClick={onDismissOverlay}
            >
              Dismiss
            </Button>
          ) : null}
        </Banner>
      ) : null}
    </Card>
  );
}

function badgeTone(status: BalanceDisplayStatus): string {
  switch (status) {
    case BALANCE_DISPLAY_STATUS.SUCCESS:
      return "badge-ok";
    case BALANCE_DISPLAY_STATUS.OPTIMISTIC_PENDING:
    case BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION:
      return "badge-accent";
    case BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK:
    case BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT:
      return "badge-warn";
    case BALANCE_DISPLAY_STATUS.HCM_REJECTED:
    case BALANCE_DISPLAY_STATUS.ERROR:
      return "badge-danger";
    default:
      return "";
  }
}

function statusLabel(status: BalanceDisplayStatus): string {
  switch (status) {
    case BALANCE_DISPLAY_STATUS.LOADING:
      return "Loading";
    case BALANCE_DISPLAY_STATUS.STALE:
      return "Stale";
    case BALANCE_DISPLAY_STATUS.OPTIMISTIC_PENDING:
      return "Pending";
    case BALANCE_DISPLAY_STATUS.OPTIMISTIC_ROLLED_BACK:
      return "Rolled back";
    case BALANCE_DISPLAY_STATUS.HCM_REJECTED:
      return "Rejected";
    case BALANCE_DISPLAY_STATUS.HCM_SILENT_CONFLICT:
      return "Conflict";
    case BALANCE_DISPLAY_STATUS.REFRESHED_MID_SESSION:
      return "Updated";
    case BALANCE_DISPLAY_STATUS.ERROR:
      return "Error";
    case BALANCE_DISPLAY_STATUS.SUCCESS:
      return "Current";
    default:
      return "Idle";
  }
}

type EmployeeBalancesViewProps = {
  cards: BalanceCardState[];
  isLoading: boolean;
  onDismissOverlay: (locationId: string) => void;
  onSimulateAnniversary: () => void;
  onArmSilentFail: () => void;
  onArmConflict: () => void;
  isSimulating: boolean;
};

function EmployeeBalancesView({
  cards,
  isLoading,
  onDismissOverlay,
  onSimulateAnniversary,
  onArmSilentFail,
  onArmConflict,
  isSimulating,
}: EmployeeBalancesViewProps) {
  if (isLoading && cards.length === 0) {
    return (
      <section className="section">
        <h2 className="section-title">Your balances</h2>
        <div className="balance-card-loading">
          <Spinner />
          <span>Loading balances…</span>
        </div>
      </section>
    );
  }

  if (cards.length === 0) {
    return (
      <section className="section">
        <h2 className="section-title">Your balances</h2>
        <p className="empty-state">No balance locations found.</p>
      </section>
    );
  }

  return (
    <section className="section">
      <h2 className="section-title">Your balances</h2>
      <div className="card-grid">
        {cards.map((card) => (
          <BalanceCard
            key={card.locationId}
            {...card}
            onDismissOverlay={() => onDismissOverlay(card.locationId)}
          />
        ))}
      </div>
      <div className="demo-panel">
        <p className="demo-panel-label">Demo scenarios (mock HCM)</p>
        <div className="demo-panel-actions">
          <Button
            variant="secondary"
            disabled={isSimulating}
            onClick={onSimulateAnniversary}
          >
            Anniversary bonus
          </Button>
          <Button
            variant="secondary"
            disabled={isSimulating}
            onClick={onArmSilentFail}
          >
            Arm silent fail
          </Button>
          <Button
            variant="secondary"
            disabled={isSimulating}
            onClick={onArmConflict}
          >
            Arm conflict
          </Button>
        </div>
      </div>
    </section>
  );
}

type EmployeeBalancesContainerProps = {
  employeeId: string;
};

export default function EmployeeBalancesContainer({
  employeeId,
}: EmployeeBalancesContainerProps) {
  const queryClient = useQueryClient();
  const { cards, isLoading, clearOverlay } = useBalances(employeeId);

  const simulateMutation = useMutation({
    mutationFn: async (action: "anniversary" | "silent-fail" | "conflict") => {
      if (action === "anniversary") {
        await simulateAnniversary(employeeId);
      } else if (action === "silent-fail") {
        await armSilentFailScenario();
      } else {
        await armConflictScenario();
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: BALANCE_KEYS.byEmployee(employeeId),
      });
    },
  });

  return (
    <EmployeeBalancesView
      cards={cards}
      isLoading={isLoading}
      onDismissOverlay={clearOverlay}
      onSimulateAnniversary={() => simulateMutation.mutate("anniversary")}
      onArmSilentFail={() => simulateMutation.mutate("silent-fail")}
      onArmConflict={() => simulateMutation.mutate("conflict")}
      isSimulating={simulateMutation.isPending}
    />
  );
}
