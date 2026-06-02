# Request form state transitions

Employee submit flow (`RequestFormStatus`). No two UI states are collapsed.

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> validating: submit
  validating --> idle: validation-failed
  validating --> submitting: validation-passed
  submitting --> submit-success: mutation-success + onSettled
  submitting --> submit-rolled-back: mutation-error
  submitting --> submit-hcm-rejected: hcm-rejected
  submitting --> submit-silent-conflict: silent-conflict after onSettled
  submit-success --> idle: dismiss / new request
  submit-rolled-back --> idle: dismiss
  submit-hcm-rejected --> idle: edit and retry
  submit-silent-conflict --> idle: verify and retry
```

## Rules

- **submit-success** is not shown until `onSettled` completes and cache is reconciled.
- **submit-rolled-back** restores the balance snapshot from `onError`; data is ground truth again.
- **submit-silent-conflict** is set when the write returned success but post-settle balance mismatch (`SILENT_FAILURE`).

## Balance display (reference)

See `BALANCE_DISPLAY_STATUS` in `src/shared/hcm/constants.ts` and TRD §8.
