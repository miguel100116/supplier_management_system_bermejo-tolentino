# Response provenance migration runbook

Status: repository preparation only, 2026-09-24. Migration `202609220001_response_provenance` remains unapplied and must not be executed without separate staging authorization.

## Why the verified preflight reports 6,355 pending and zero exact rows

The normalized staging import contains 6,355 `evaluation_answers`: Courier 540, Subcontractor 1,560, and Supplier 4,255. Migration `202609160002_application_persistence.sql` seeded one `application_records/survey_response` row per answer with the stable key `<submission id>:<canonical question key>`, but that earlier seed did not include `dataSource` or `importBatchId`.

Migration `202609220001_response_provenance.sql` has not been applied. Therefore every exact imported answer projection is expected to be pending (`dataSource is null`) and none is expected to already have the exact `client_csv` provenance. The totals reconcile exactly to the previously verified 6,355 normalized answers. This explanation does not replace a fresh read-only staging preflight immediately before execution.

## Deterministic classification

- Rows joined to `evaluation_submissions` by `payload.responseId = evaluation_submissions.id` are classified as `client_csv` only while `payload.dataSource` is null.
- Their batch ID is deterministic: `client-csv:<lowercase form code>:<source-file SHA-256>`.
- Browser imports already classified by the application as `client_csv` are left unchanged.
- Approved production submissions use `production_submission`; staging and legacy pre-production submissions use `test_submission`.
- The migration never guesses the provenance of a row that cannot be joined to the normalized import and never overwrites any non-null `dataSource`.

The migration is idempotent: after the first successful update, its `payload ->> 'dataSource' is null` predicate excludes every row it changed. A repeat run must update zero rows and leave all payloads unchanged.

## Required staging preflight

1. Confirm the target project identifier and record the operator and approved window.
2. Confirm the migration ledger still shows `202609220001_response_provenance` as unapplied.
3. Run `supabase/verification/response_provenance_readiness.sql` read-only.
4. Stop if normalized, exact application, or pending totals differ; if any imported application row is missing; or if any non-null provenance conflicts with the deterministic classification.
5. Capture a recoverable database backup or point-in-time recovery marker according to the approved Supabase plan. Record its identifier and verify restore access before migration execution.
6. Export only the affected record identifiers and their pre-migration `dataSource`/`importBatchId` fields to an access-controlled, non-repository location. Do not export response content into Git or CI artifacts.

## Post-migration thresholds

The staging execution is acceptable only when all conditions hold:

- exact provenance: Courier 540, Subcontractor 1,560, Supplier 4,255, total 6,355;
- pending imported rows: zero;
- missing exact application rows: zero;
- protected nonmatching rows: zero;
- total `survey_response` record count is unchanged;
- no response payload field other than `dataSource` and `importBatchId` changed;
- the migration ledger contains `202609220001_response_provenance` exactly once;
- a repeat of the migration predicate selects zero rows;
- focused application tests and an authenticated staging Analytics smoke test pass.

Any failed condition stops release progression and requires investigation before retry.

## Recovery decision

If reconciliation fails, stop application promotion. Prefer point-in-time restore when the failure affects unknown fields or row counts. If evidence proves the only incorrect changes are the two provenance keys on the captured affected IDs, a reviewed compensating transaction may restore those exact fields from the protected preflight export. Never use a blanket update against all responses. Re-run the complete readiness query and compare record counts and payload hashes after recovery.

Production requires its own preflight, backup, approval, execution window, and reconciliation. Staging evidence is not production evidence.
