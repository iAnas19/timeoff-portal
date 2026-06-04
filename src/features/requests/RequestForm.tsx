"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  calculateAvailableBalance,
  countInclusiveDays,
} from "@/features/balances/balance.utils";
import { useSubmitRequest } from "@/features/requests/useSubmitRequest";
import { REQUEST_FORM_STATUS } from "@/shared/hcm/constants";
import { Alert, Banner, Button, Card, Spinner } from "@/shared/ui";
import type { RequestFormStatus } from "@/shared/hcm/constants";
import type { BalanceCell } from "@/shared/hcm/schemas";

export type RequestFormViewProps = {
  locations: BalanceCell[];
  formStatus: RequestFormStatus;
  statusMessage?: string;
  maxDays: number;
  isSubmitting: boolean;
  onSubmit: (input: {
    locationId: string;
    days: number;
    startDate: string;
    endDate: string;
  }) => void;
  onReset: () => void;
};

const TERMINAL_STATUSES: RequestFormStatus[] = [
  REQUEST_FORM_STATUS.SUBMIT_SUCCESS,
  REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK,
  REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED,
  REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT,
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type LocationOption = BalanceCell & { available: number };

export function RequestFormView({
  locations,
  formStatus,
  statusMessage,
  maxDays,
  isSubmitting,
  onSubmit,
  onReset,
}: RequestFormViewProps) {
  const today = todayIso();

  const options = useMemo<LocationOption[]>(
    () =>
      locations.map((cell) => ({
        ...cell,
        available: calculateAvailableBalance(
          cell.confirmedBalance,
          cell.pendingDeductions,
        ),
      })),
    [locations],
  );

  const firstAvailable = options.find((option) => option.available > 0);
  const allExhausted = options.length > 0 && !firstAvailable;

  const [pickedLocationId, setPickedLocationId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Derive the effective location instead of syncing it in an effect: fall back
  // to the first selectable location until the user explicitly picks one, and
  // drop a picked location that is no longer selectable (balance changed).
  const locationId = options.some(
    (option) => option.locationId === pickedLocationId && option.available > 0,
  )
    ? pickedLocationId
    : (firstAvailable?.locationId ?? "");

  const selected = options.find((option) => option.locationId === locationId);
  const requestedDays = countInclusiveDays(startDate, endDate);
  const available = selected?.available ?? 0;
  const remainingAfter = available - requestedDays;

  const validationError = useMemo<string | null>(() => {
    if (allExhausted) {
      return "No balance is available to request against right now.";
    }
    if (!locationId) {
      return "Select a location.";
    }
    if (!startDate || !endDate) {
      return "Pick a start and end date.";
    }
    if (countInclusiveDays(startDate, endDate) === 0) {
      return "End date can’t be before the start date.";
    }
    if (startDate < today) {
      return "Start date can’t be in the past.";
    }
    if (requestedDays > maxDays) {
      return `A single request can’t exceed ${maxDays} days.`;
    }
    if (requestedDays > available) {
      return `Only ${available} day${available === 1 ? "" : "s"} available at ${selected?.locationName}.`;
    }
    return null;
  }, [
    allExhausted,
    available,
    endDate,
    locationId,
    maxDays,
    requestedDays,
    selected?.locationName,
    startDate,
    today,
  ]);

  const busy =
    isSubmitting ||
    formStatus === REQUEST_FORM_STATUS.SUBMITTING ||
    formStatus === REQUEST_FORM_STATUS.VALIDATING;
  const disabled = busy || allExhausted || options.length === 0;

  // Editing after a finished attempt clears the previous result banner.
  function clearTerminalBanner() {
    if (TERMINAL_STATUSES.includes(formStatus)) {
      onReset();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (validationError) {
      return;
    }
    onSubmit({ locationId, days: requestedDays, startDate, endDate });
  }

  return (
    <Card className="request-form">
      <h2 className="section-title">Request time off</h2>

      {formStatus === REQUEST_FORM_STATUS.SUBMIT_SUCCESS && statusMessage ? (
        <Banner className="form-banner form-banner-success">
          {statusMessage}
        </Banner>
      ) : null}

      {(formStatus === REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK ||
        formStatus === REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED) &&
      statusMessage ? (
        <Alert className="form-banner">{statusMessage}</Alert>
      ) : null}

      {formStatus === REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT &&
      statusMessage ? (
        <Banner className="form-banner form-banner-warn">{statusMessage}</Banner>
      ) : null}

      {allExhausted ? (
        <p className="empty-state">
          Every location is fully booked — no balance left to request against.
        </p>
      ) : (
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Location</span>
            <select
              value={locationId}
              onChange={(event) => {
                clearTerminalBanner();
                setPickedLocationId(event.target.value);
              }}
              disabled={disabled}
            >
              {options.map((option) => (
                <option
                  key={option.locationId}
                  value={option.locationId}
                  disabled={option.available <= 0}
                >
                  {option.locationName} —{" "}
                  {option.available > 0
                    ? `${option.available} day${option.available === 1 ? "" : "s"} available`
                    : "exhausted"}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label className="form-field">
              <span>First day off</span>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(event) => {
                  clearTerminalBanner();
                  const next = event.target.value;
                  setStartDate(next);
                  if (endDate < next) {
                    setEndDate(next);
                  }
                }}
                disabled={disabled}
              />
            </label>

            <label className="form-field">
              <span>Last day off</span>
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                onChange={(event) => {
                  clearTerminalBanner();
                  setEndDate(event.target.value);
                }}
                disabled={disabled}
              />
            </label>
          </div>

          <p className="form-summary" aria-live="polite">
            {requestedDays > 0 ? (
              <>
                Requesting <strong>{requestedDays}</strong> day
                {requestedDays === 1 ? "" : "s"}
                {selected ? (
                  <>
                    {" · "}
                    {remainingAfter >= 0
                      ? `${remainingAfter} left after this`
                      : `${available} available`}
                  </>
                ) : null}
              </>
            ) : (
              "Choose your dates to see how many days this uses."
            )}
          </p>

          {validationError && !busy ? (
            <p className="form-validation">{validationError}</p>
          ) : null}

          {busy ? (
            <div className="form-status">
              <Spinner />{" "}
              {formStatus === REQUEST_FORM_STATUS.VALIDATING
                ? "Checking…"
                : "Submitting…"}
            </div>
          ) : null}

          <div className="form-actions">
            <Button
              type="submit"
              disabled={disabled || validationError !== null}
            >
              Submit request
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

type RequestFormContainerProps = {
  employeeId: string;
};

export default function RequestFormContainer({
  employeeId,
}: RequestFormContainerProps) {
  const {
    formStatus,
    statusMessage,
    locations,
    submit,
    resetForm,
    isSubmitting,
    maxDays,
  } = useSubmitRequest(employeeId);

  return (
    <RequestFormView
      locations={locations}
      formStatus={formStatus}
      statusMessage={statusMessage}
      maxDays={maxDays}
      isSubmitting={isSubmitting}
      onSubmit={submit}
      onReset={resetForm}
    />
  );
}
