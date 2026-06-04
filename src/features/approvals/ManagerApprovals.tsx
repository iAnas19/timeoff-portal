"use client";

import type { ApprovalCardState } from "@/features/approvals/useApprovals";
import { useApprovals } from "@/features/approvals/useApprovals";
import { isHCMError } from "@/shared/api/errors";
import { APPROVAL_CARD_STATUS } from "@/shared/hcm/constants";
import { Alert, Badge, Button, Card, Spinner } from "@/shared/ui";
import type { ApprovalCardStatus } from "@/shared/hcm/constants";

export type ManagerApprovalCardProps = ApprovalCardState & {
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
};

export function ManagerApprovalCard({
  approval,
  status,
  liveAvailableBalance,
  message,
  onApprove,
  onDeny,
}: ManagerApprovalCardProps) {
  const { request } = approval;
  const queuedAvailable = Math.max(
    0,
    approval.balanceAtQueueTime.confirmedBalance -
      approval.balanceAtQueueTime.pendingDeductions,
  );

  const actionsDisabled =
    status === APPROVAL_CARD_STATUS.APPROVING ||
    status === APPROVAL_CARD_STATUS.APPROVED ||
    status === APPROVAL_CARD_STATUS.DENIED;

  return (
    <Card className="approval-card">
      <div className="approval-card-header">
        <div>
          <span className="balance-card-eyebrow">Pending request</span>
          <h3 className="approval-card-title">
            {approval.employeeDisplayName}
          </h3>
          <p className="approval-card-subtitle">
            {approval.locationName} · {request.days} day
            {request.days === 1 ? "" : "s"} · {request.startDate} →{" "}
            {request.endDate}
          </p>
        </div>
        <Badge className={approvalBadgeTone(status)}>
          {approvalStatusLabel(status)}
        </Badge>
      </div>

      <dl className="approval-meta">
        <div>
          <dt>At queue time</dt>
          <dd>{queuedAvailable} days available</dd>
        </div>
        <div>
          <dt>Live balance</dt>
          <dd>
            {liveAvailableBalance === null
              ? "Loading…"
              : `${liveAvailableBalance} days available`}
          </dd>
        </div>
      </dl>

      {status === APPROVAL_CARD_STATUS.PENDING_STALE_BALANCE && message ? (
        <Alert className="approval-note">{message}</Alert>
      ) : null}

      {status === APPROVAL_CARD_STATUS.CONFLICT_ON_APPROVE && message ? (
        <Alert className="approval-note">{message}</Alert>
      ) : null}

      {status === APPROVAL_CARD_STATUS.REJECTED_ON_APPROVE && message ? (
        <Alert className="approval-note">{message}</Alert>
      ) : null}

      {status === APPROVAL_CARD_STATUS.APPROVING ? (
        <div className="form-status">
          <Spinner /> {message ?? "Processing…"}
        </div>
      ) : null}

      {status === APPROVAL_CARD_STATUS.APPROVED ? (
        <p className="approval-result approval-result-success">Approved</p>
      ) : null}

      {status === APPROVAL_CARD_STATUS.DENIED ? (
        <p className="approval-result approval-result-denied">Denied</p>
      ) : null}

      <div className="form-actions">
        <Button
          disabled={actionsDisabled}
          onClick={() => onApprove(request.id)}
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          disabled={actionsDisabled}
          onClick={() => onDeny(request.id)}
        >
          Deny
        </Button>
      </div>
    </Card>
  );
}

function approvalBadgeTone(status: ApprovalCardStatus): string {
  switch (status) {
    case APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE:
    case APPROVAL_CARD_STATUS.APPROVED:
      return "badge-ok";
    case APPROVAL_CARD_STATUS.PENDING_STALE_BALANCE:
      return "badge-warn";
    case APPROVAL_CARD_STATUS.CONFLICT_ON_APPROVE:
    case APPROVAL_CARD_STATUS.REJECTED_ON_APPROVE:
    case APPROVAL_CARD_STATUS.DENIED:
      return "badge-danger";
    default:
      return "";
  }
}

function approvalStatusLabel(status: ApprovalCardStatus): string {
  switch (status) {
    case APPROVAL_CARD_STATUS.PENDING_FRESH_BALANCE:
      return "Fresh balance";
    case APPROVAL_CARD_STATUS.PENDING_STALE_BALANCE:
      return "Stale balance";
    case APPROVAL_CARD_STATUS.APPROVING:
      return "Processing";
    case APPROVAL_CARD_STATUS.APPROVED:
      return "Approved";
    case APPROVAL_CARD_STATUS.DENIED:
      return "Denied";
    case APPROVAL_CARD_STATUS.CONFLICT_ON_APPROVE:
      return "Conflict";
    case APPROVAL_CARD_STATUS.REJECTED_ON_APPROVE:
      return "Rejected";
    default:
      return status;
  }
}

type ManagerApprovalsViewProps = {
  cards: ApprovalCardState[];
  isLoading: boolean;
  errorMessage?: string;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
};

function ManagerApprovalsView({
  cards,
  isLoading,
  errorMessage,
  onApprove,
  onDeny,
}: ManagerApprovalsViewProps) {
  if (isLoading) {
    return (
      <div className="balance-card-loading">
        <Spinner />
        <span>Loading approval queue…</span>
      </div>
    );
  }

  if (errorMessage) {
    return <Alert role="alert">{errorMessage}</Alert>;
  }

  if (cards.length === 0) {
    return <p className="empty-state">No pending approvals.</p>;
  }

  return (
    <div className="card-grid">
      {cards.map((card) => (
        <ManagerApprovalCard
          key={card.approval.request.id}
          {...card}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      ))}
    </div>
  );
}

export default function ManagerApprovalsContainer() {
  const { cards, isLoading, error, approve, deny } = useApprovals();

  return (
    <section className="section">
      <h2 className="section-title">Pending approvals</h2>
      <ManagerApprovalsView
        cards={cards}
        isLoading={isLoading}
        errorMessage={
          isHCMError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : undefined
        }
        onApprove={approve}
        onDeny={deny}
      />
    </section>
  );
}
