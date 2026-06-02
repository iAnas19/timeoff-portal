export type {
  ApproveRequestInput,
  BalanceBatchResponse,
  BalanceCell,
  BalanceWriteInput,
  DenyRequestInput,
  EmployeeBalances,
  HCMError,
  PendingApproval,
  PendingApprovalsResponse,
  PatchTimeOffRequestInput,
  SubmitTimeOffRequestInput,
  TimeOffRequest,
} from "@/shared/hcm/schemas";

export type {
  ApprovalCardStatus,
  BalanceDisplayStatus,
  BalanceFreshness,
  HcmErrorCode,
  RequestFormStatus,
  RequestStatus,
} from "@/shared/hcm/constants";

export type BalanceCellKey = {
  employeeId: string;
  locationId: string;
};

export type OptimisticDeductionInput = {
  locationId: string;
  days: number;
};

export type SilentFailureCheckInput = {
  writeSucceeded: boolean;
  expectedConfirmedBalance: number;
  actualConfirmedBalance: number;
};

export type PollBufferCheckInput = {
  isMutationPending: boolean;
  polledConfirmedBalance: number;
  displayedConfirmedBalance: number;
};

export type RequestListResponse = {
  requests: TimeOffRequest[];
};

import type { TimeOffRequest } from "@/shared/hcm/schemas";
import { REQUEST_FORM_STATUS } from "@/shared/hcm/constants";

export type RequestFormStateTransition =
  | {
      from: REQUEST_FORM_STATUS.IDLE;
      event: "change-field";
      to: REQUEST_FORM_STATUS.IDLE;
    }
  | {
      from: REQUEST_FORM_STATUS.IDLE;
      event: "submit";
      to: REQUEST_FORM_STATUS.VALIDATING;
    }
  | {
      from: REQUEST_FORM_STATUS.VALIDATING;
      event: "validation-failed";
      to: REQUEST_FORM_STATUS.IDLE;
    }
  | {
      from: REQUEST_FORM_STATUS.VALIDATING;
      event: "validation-passed";
      to: REQUEST_FORM_STATUS.SUBMITTING;
    }
  | {
      from: REQUEST_FORM_STATUS.SUBMITTING;
      event: "mutation-success";
      to: REQUEST_FORM_STATUS.SUBMIT_SUCCESS;
    }
  | {
      from: REQUEST_FORM_STATUS.SUBMITTING;
      event: "mutation-error";
      to: REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK;
    }
  | {
      from: REQUEST_FORM_STATUS.SUBMITTING;
      event: "hcm-rejected";
      to: REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED;
    }
  | {
      from: REQUEST_FORM_STATUS.SUBMITTING;
      event: "silent-conflict";
      to: REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT;
    };
