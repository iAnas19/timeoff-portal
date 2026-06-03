"use client";

import { useState } from "react";
import { useSubmitRequest } from "@/features/requests/useSubmitRequest";
import { REQUEST_FORM_STATUS } from "@/shared/hcm/constants";
import { Alert, Banner, Button, Card, Spinner } from "@/shared/ui";
import type { RequestFormStatus } from "@/shared/hcm/constants";
import type { BalanceCell } from "@/shared/hcm/schemas";

export type RequestFormViewProps = {
  locations: BalanceCell[];
  formStatus: RequestFormStatus;
  statusMessage?: string;
  minDays: number;
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

export function RequestFormView({
  locations,
  formStatus,
  statusMessage,
  minDays,
  maxDays,
  isSubmitting,
  onSubmit,
  onReset,
}: RequestFormViewProps) {
  const [locationId, setLocationId] = useState(locations[0]?.locationId ?? "");
  const [days, setDays] = useState("1");
  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-01");

  const disabled =
    isSubmitting ||
    formStatus === REQUEST_FORM_STATUS.SUBMITTING ||
    formStatus === REQUEST_FORM_STATUS.VALIDATING ||
    locations.length === 0;

  return (
    <Card className="request-form">
      <h2 className="section-title">Request time off</h2>

      {formStatus === REQUEST_FORM_STATUS.SUBMIT_SUCCESS && statusMessage ? (
        <Banner className="form-banner form-banner-success">{statusMessage}</Banner>
      ) : null}

      {formStatus === REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK && statusMessage ? (
        <Alert className="form-banner">{statusMessage}</Alert>
      ) : null}

      {formStatus === REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED && statusMessage ? (
        <Alert className="form-banner">{statusMessage}</Alert>
      ) : null}

      {formStatus === REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT &&
      statusMessage ? (
        <Banner className="form-banner form-banner-warn">{statusMessage}</Banner>
      ) : null}

      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            locationId,
            days: Number(days),
            startDate,
            endDate,
          });
        }}
      >
        <label className="form-field">
          <span>Location</span>
          <select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            disabled={disabled}
          >
            {locations.map((location) => (
              <option key={location.locationId} value={location.locationId}>
                {location.locationName}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Days ({minDays}–{maxDays})</span>
          <input
            type="number"
            min={minDays}
            max={maxDays}
            step="0.5"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="form-field">
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="form-field">
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            disabled={disabled}
          />
        </label>

        {formStatus === REQUEST_FORM_STATUS.VALIDATING ? (
          <p className="form-status">
            <Spinner /> Validating…
          </p>
        ) : null}

        {formStatus === REQUEST_FORM_STATUS.SUBMITTING ? (
          <p className="form-status">
            <Spinner /> Submitting…
          </p>
        ) : null}

        {statusMessage &&
        formStatus === REQUEST_FORM_STATUS.IDLE &&
        !isSubmitting ? (
          <Alert className="form-inline-error">{statusMessage}</Alert>
        ) : null}

        <div className="form-actions">
          <Button type="submit" disabled={disabled}>
            Submit request
          </Button>
          {(formStatus === REQUEST_FORM_STATUS.SUBMIT_SUCCESS ||
            formStatus === REQUEST_FORM_STATUS.SUBMIT_ROLLED_BACK ||
            formStatus === REQUEST_FORM_STATUS.SUBMIT_HCM_REJECTED ||
            formStatus === REQUEST_FORM_STATUS.SUBMIT_SILENT_CONFLICT) && (
            <Button type="button" variant="secondary" onClick={onReset}>
              New request
            </Button>
          )}
        </div>
      </form>
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
    minDays,
    maxDays,
  } = useSubmitRequest(employeeId);

  return (
    <RequestFormView
      locations={locations}
      formStatus={formStatus}
      statusMessage={statusMessage}
      minDays={minDays}
      maxDays={maxDays}
      isSubmitting={isSubmitting}
      onSubmit={submit}
      onReset={resetForm}
    />
  );
}
