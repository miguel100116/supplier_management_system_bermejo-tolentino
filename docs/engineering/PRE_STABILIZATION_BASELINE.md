# Pre-stabilization baseline completion record

Status: completed locally on 2026-09-24
Baseline date represented by the tag: 2026-09-23
Branch: `stabilization/pre-production-baseline`
Commit: `62beb970d2bb55281c8c02ab6f45490dc66bec0e`
Local annotated tag: `stabilization-baseline-2026-09-23`

This document records what is complete in the pre-stabilization Git baseline. It is not production approval, migration authorization, or evidence that the known security and authorization gaps have been resolved.

## Completed repository work

The legitimate work preceding stabilization was separated into eight reviewable commits:

| Commit | Completed scope |
|---|---|
| `d5bf871` | Normalized CSV line endings before import checksums are calculated. |
| `d225229` | Added shared filtering and sorting controls to operational tables, with focused helper tests. |
| `b3cbdce` | Preserved module navigation context and shared Back behavior. |
| `7033e61` | Aligned Analytics ranking calculations with the selected ranking mode and reorganized the Analytics presentation hierarchy. |
| `49f616f` | Added evaluation-response provenance fields, environment classification, tests, and the versioned provenance migration. |
| `7675906` | Added immutable Active Companies snapshot history, upload parsing, tests, repository integration, and its versioned migration. |
| `ae9a4b4` | Refreshed shared access settings when Supabase Realtime invalidation events are received. |
| `62beb97` | Aligned the README, turnover notes, second brain, normalized-import documentation, and frontend-to-Supabase connection map. |

The original local `second-branch` remains preserved at `7a029f7`. Neither the baseline branch nor its tag was pushed as part of this work.

## Migration tracking state

Both migrations required by the baseline are tracked in Git:

- `supabase/migrations/202609220001_response_provenance.sql`
- `supabase/migrations/202609230001_active_company_snapshots.sql`

Verified staging state supplied during the Phase 2C investigation:

- `202609230001_active_company_snapshots` is recorded as applied in staging.
- `202609220001_response_provenance` is not recorded as applied.
- Provenance reconciliation found 6,355 pending rows: Courier 540, Subcontractor 1,560, and Supplier 4,255.
- The reconciliation found zero exact provenance rows.

Tracking a migration does not authorize its execution. No migration was executed while assembling or verifying this baseline.

## Verification evidence

The baseline was rebuilt from the repository on 2026-09-24:

| Check | Result |
|---|---|
| `npm ci` | Passed; installed 335 packages without changing tracked dependency files. |
| `npm run lint` | Passed; this script performs TypeScript checks for the application and import scripts. |
| `npm test` | Passed: 73 tests, 0 failures. |
| `npm run build` | Passed; Vite and the bundled Express server completed successfully. |
| `git diff --check` | Passed. |
| `git status --short` | Clean. |
| Tracked test inventory | 19 test files. |
| Targeted credential-signature scan | No tracked JWT-like tokens, private keys, common live secret prefixes, or Supabase secret-key signatures found. |

The initial sandboxed test and build attempts could not spawn worker processes on Windows (`EPERM`). Both commands passed when rerun with permission to spawn their normal child processes. The build emitted a non-blocking large-chunk warning.

`npm ci` reported 11 dependency audit findings: 5 moderate, 5 high, and 1 critical. They were not automatically modified because dependency remediation is stabilization work and requires review and regression testing.

## Intentionally excluded artifacts

The following files remain present locally but are ignored and uncommitted:

- `docs/Supplier_Management_System_Flow.pdf`
- `docs/_build/generate-system-flow-pdf.cjs`
- `scratch/`

They are not required to install, test, type-check, or build the application.

## What this baseline proves

- The recorded repository state can install, type-check, test, and build from its lockfile.
- The completed source changes and their focused tests are tracked.
- The two pending/related migrations are versioned without implying execution.
- The baseline provides a stable rollback and comparison point for later stabilization work.

## What this baseline does not prove

- It does not prove that staging and production schemas match the migration directory.
- It does not approve or execute the response-provenance migration.
- It does not resolve the authorization gaps listed in `SUPABASE_FRONTEND_ALIGNMENT.md`.
- It does not constitute user-acceptance, penetration, load, recovery, or production-readiness testing.
- It does not approve a production deployment or release.
