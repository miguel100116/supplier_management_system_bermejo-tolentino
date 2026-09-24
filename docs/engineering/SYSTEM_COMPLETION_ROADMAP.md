# System completion and stabilization roadmap

Status: proposed execution plan as of 2026-09-24
Starting point: local tag `stabilization-baseline-2026-09-23`

This roadmap describes the remaining work needed to move from the reproducible pre-stabilization baseline to a production-ready Supplier Management System. “Complete” means supported by executable evidence and environment-specific verification, not merely implemented or successfully built.

Every remaining unchecked item is labeled with the authority or evidence it still needs. It must not be checked merely because repository code exists: `[STAGING]` and `[PRODUCTION]` require the named environment, `[OWNER]` requires an accountable human decision, and `[TEST PROGRAM]` requires the intended backend, identities, and journey harness.

## Operating rules

- Complete and review one phase before beginning a dependent phase.
- Keep staging and production evidence separate.
- Never widen raw-data access to compensate for a missing aggregate or mutation API.
- Apply migrations only with explicit authorization, a verified target, preflight evidence, reconciliation queries, and a recovery plan.
- Do not deploy, push, merge, or alter production from this roadmap without separate authorization.
- Preserve `stabilization-baseline-2026-09-23` as the pre-stabilization comparison point.
- Record durable decisions and verified environment state in `SECOND_BRAIN.md`.

## Phase 1 — Provenance migration readiness

Goal: make the response-provenance migration safe to authorize in staging without executing it prematurely.

- [x] Explain why reconciliation reports 6,355 pending rows and zero exact provenance rows.
- [ ] [STAGING] Review the migration against the actual staging schema and data counts.
- [x] Establish deterministic classification rules for client CSV, staging submission, and production submission provenance.
- [x] Prove statically that the migration is idempotent and does not overwrite already classified rows.
- [x] Define pre-migration backup/recovery and rollback procedures.
- [x] Define post-migration reconciliation totals and failure thresholds.
- [ ] [OWNER/STAGING] Obtain explicit authorization for a staging-only execution window.
- [ ] [STAGING] After execution, verify the migration ledger, counts, classifications, application behavior, and repeat-run safety.

Exit criteria: reviewed SQL and reconciliation produce an explainable plan; staging execution is separately authorized; post-execution evidence contains no unexplained row loss, duplication, or provenance classification.

## Phase 2 — Authorization and data-integrity stabilization

Goal: make the server/database boundary enforce every capability exposed by the UI.

### Company-wide aggregate Analytics

- [x] Design and version a protected aggregate RPC that returns only approved grouped metrics.
- [x] Preserve raw response RLS for Supervisory and Rank & File users.
- [x] Route lower-rank Analytics through the aggregate boundary.
- [ ] [STAGING] Test Admin, Executive, Director, Supervisory, and Rank & File positive and negative cases.
- [x] Statically verify suppression and that aggregate outputs omit respondent identity, comments, and raw response IDs.

### Delegated document renewal

- [x] Define the exact fields a `renew-documents` delegate may change.
- [x] Add a narrowly validated server-side renewal operation.
- [x] Write the renewal and modification audit entry atomically.
- [x] Reject company/profile/registry changes outside the renewal contract.
- [x] Add static contract tests for permission, malformed fields, stale-update locking, grants, and prohibited UI changes.
- [ ] [STAGING] Add database-backed permitted, denied, malformed, stale-update, and concurrent-update tests after the migration is authorized in staging.

### Archive operations

- [x] Decide that Archive Center is Admin-only.
- [x] Align default and effective navigation permissions with that decision.
- [x] Delegated archive operations are not applicable under the approved Admin-only decision.
- [x] Preserve Admin-only response update/delete policies and prevent custom client overrides from exposing Archive Center.
- [ ] [STAGING] Test restore collisions, partial failures, and permanent-deletion authorization.

### Failed-write consistency

- [x] Await authorization-sensitive remote mutations before reporting success and request authoritative refetch after rejection.
- [x] Remove misleading success states caused by rejected optimistic writes.
- [x] Provide actionable, non-sensitive errors and preserve retry safety through stable record IDs.

Exit criteria: UI permissions and database enforcement agree; denied mutations do not persist or remain presented as successful; role-boundary tests pass against a disposable or approved staging environment.

## Phase 3 — Runtime validation and persistence hardening

Goal: reject malformed external or persisted data before it reaches domain/UI code.

- [x] Add runtime schemas/parsers for every `application_records` payload type.
- [x] Validate profile and permission payloads at the repository boundary.
- [ ] [TEST PROGRAM] Complete uniform runtime validation and negative coverage for every CSV/XLSX input, URL parameter, device-only cached UI record, and external API response.
- [x] Quarantine and report invalid remote rows without silently dropping valid neighboring records.
- [ ] [PRODUCT/DATA] Inventory deployed legacy cache shapes and approve compatibility/expiry handling for each version.
- [x] Add tests for malformed objects, missing/mismatched identifiers, invalid dates/enums, oversized inputs, and supported legacy date shapes.

Exit criteria: every untrusted persistence and import boundary has runtime validation, negative tests, and an explicit error/recovery path.

## Phase 4 — Authentication and account recovery

Goal: make account access supportable and safe for the approved production identity model.

- [ ] [OWNER] Decide the production authentication provider: Supabase password auth or approved Microsoft Entra integration.
- [x] Implement and locally test password reset/recovery if Supabase password auth remains enabled.
- [x] Document account provisioning, confirmation, suspension, role promotion, and emergency Admin recovery in `AUTH_OPERATIONS.md`.
- [ ] [OWNER/HOSTED] Enable leaked-password protection when the selected Supabase plan supports it, or approve a time-bounded compensating control.
- [x] If Microsoft login is enabled, require successful Supabase session exchange before authentication completes.
- [ ] [STAGING] Exercise session timeout, multi-tab behavior, logout, revoked sessions, and disabled-account handling with real provider sessions.

Exit criteria: users and administrators have tested sign-in, recovery, logout, revocation, and provisioning procedures with no frontend-only authorization dependency.

## Phase 5 — Dependency and supply-chain remediation

Goal: resolve or formally triage the clean-install audit findings without unreviewed breaking upgrades.

- [x] Capture `npm audit` results with direct versus transitive dependency ownership.
- [x] Triage the 1 critical, 5 high, and 5 moderate findings for runtime reachability and exploitability.
- [x] Upgrade or replace affected dependencies in small, reviewable changes.
- [x] Do not use `npm audit fix --force` without reviewing breaking changes.
- [x] Review required package install scripts and document why each is trusted in `DEPENDENCY_SECURITY.md`.
- [x] Re-run TypeScript checks, all 97 focused tests, production build, and real XLSX/PPTX export smoke tests after remediation.
- [ ] [STAGING] Run the complete critical user journeys after the required migrations and test identities are available.

Exit criteria: no unaccepted critical/high findings remain; any time-bounded exception has an owner, rationale, mitigation, and expiry date.

## Phase 6 — Test coverage and critical-journey validation

Goal: cover business-critical behavior beyond the current focused unit/domain suite.

- [ ] [TEST PROGRAM] Add integration tests for authentication, RLS-backed persistence, Realtime invalidation, and authorization-sensitive mutations.
- [ ] [TEST PROGRAM] Add component tests for validation, error, empty, loading, accessibility, and permission states.
- [ ] [TEST PROGRAM] Add end-to-end journeys for sign-in/authorization, survey submission, partner/document management, reporting, imports, and archive behavior.
- [ ] [TEST PROGRAM] Exercise malformed imports, partial failures, time-zone/date boundaries, stale writes, and offline/network interruption.
- [ ] [TEST PROGRAM] Compare refactored UI states at representative desktop and mobile sizes with approved test data.
- [ ] [TEST PROGRAM] Perform accessibility checks for keyboard navigation, focus management, labels, dialogs, tables, and contrast.

Exit criteria: critical journeys pass in an environment using the intended backend policies, and failures demonstrate safe recovery rather than misleading success.

## Phase 7 — CI/CD and reproducible release controls

Goal: make every proposed release repeat the baseline gates automatically.

- [x] Add pull-request CI using pinned Node 22 and `npm ci`.
- [x] Configure TypeScript checking, automated tests, and production build on clean checkouts.
- [x] Add dependency and full-history secret scanning with explicit triage.
- [ ] [OWNER/REMOTE] Protect the default branch with required checks and reviewed changes after the workflow is pushed.
- [x] Keep the verification workflow build-only and upload the immutable `dist` artifact; no deployment job is coupled to build.
- [ ] [OWNER/ENVIRONMENT] Store configuration in the deployment platform with least-privilege environment identities.
- [x] Upload only the production build artifact; no environment files, logs, or customer data are uploaded.
- [x] Keep database changes in reviewed, versioned migrations and require environment authorization before application.

Exit criteria: a clean pull request cannot merge while a required gate fails, and deployment consumes the exact artifact that passed verification.

## Phase 8 — Staging acceptance and operational readiness

Goal: prove the complete system and operating procedures in staging.

- [ ] [STAGING] Reconcile the staging migration ledger against all versioned migrations.
- [ ] [STAGING] Confirm RLS, grants, private authorization helpers, and Realtime publication state.
- [ ] [STAGING] Test representative Admin, Executive, Director, Managerial, Supervisory, Rank & File, and delegated-renewal accounts.
- [ ] [OWNER/STAGING] Complete user-acceptance testing with approved business owners.
- [ ] [STAGING] Verify exports, report generation, large imports, notifications, expiry calculations, and multi-device convergence.
- [ ] [OWNER/STAGING] Establish monitoring, health checks, backup/restore testing, incident contacts, and support procedures.
- [ ] [OWNER/STAGING] Update administrator and employee manuals to match verified behavior.
- [ ] [OWNER] Resolve or explicitly accept every known issue with an owner and due date.

Exit criteria: signed staging acceptance, successful recovery exercise, no unresolved blocking defect, and an approved production runbook.

## Phase 9 — Production readiness and controlled launch

Goal: deploy only an explicitly approved, verified release with a recovery path.

- [ ] [PRODUCTION] Independently inspect production configuration and migration state; never infer it from staging.
- [ ] [OWNER/PRODUCTION] Rotate any credential previously exposed or suspected of exposure.
- [ ] [OWNER/PRODUCTION] Approve the production data migration order, maintenance window, validation queries, and rollback decision points.
- [ ] [OWNER/PRODUCTION] Approve least-privilege production identities, redirect URLs, mail scopes, and environment variables.
- [ ] [RELEASE] Create an immutable release artifact and record its commit/tag and checksums.
- [ ] [OWNER/PRODUCTION] Obtain explicit production deployment authorization.
- [ ] [PRODUCTION] Run pre-deployment backups, migration checks, health checks, smoke tests, and business validation.
- [ ] [PRODUCTION] Monitor the rollout and execute rollback if predefined thresholds are breached.

Exit criteria: production approval is documented, the approved artifact is deployed, environment-specific checks pass, and monitoring shows stable operation.

## Phase 10 — Post-launch ownership

Goal: keep the system reliable after launch.

- [ ] [OWNER] Assign product, technical, security, database, and support owners.
- [ ] [OWNER] Define incident severity, escalation, response, and communication procedures.
- [ ] [OWNER] Schedule dependency updates, access reviews, backup-restore drills, RLS reviews, and audit-log review.
- [ ] [OWNER/PRODUCTION] Track performance, error rates, failed jobs, authentication failures, and data-reconciliation signals.
- [ ] [OWNER] Maintain release notes, manuals, the second brain, and known-risk records.
- [ ] [OWNER] Review whether Microsoft Graph email and other deferred integrations remain required.

Exit criteria: recurring operational reviews are scheduled, ownership is explicit, and production risks have measurable detection and response controls.

## Release-blocking checklist

Production approval must remain blocked until all applicable items below are satisfied:

- [ ] [ENVIRONMENT] Every versioned migration has an environment-specific status and reconciliation result.
- [x] Raw response RLS is not widened to support aggregate Analytics.
- [ ] [STAGING] Delegated renewals and archive operations are proven against installed server-side controls.
- [x] Authorization-sensitive write failures cannot appear successful in the covered Partner, renewal, survey, and archive flows.
- [ ] [TEST PROGRAM] Runtime validation covers all untrusted data boundaries.
- [x] Critical/high dependency findings are resolved; the current audit reports zero vulnerabilities.
- [ ] [STAGING] Authentication recovery and administrative access procedures are tested.
- [ ] [REMOTE] Required CI gates pass on a clean hosted checkout.
- [ ] [STAGING] Critical end-to-end journeys and role-boundary tests pass in staging.
- [ ] [OWNER/ENVIRONMENT] Backup, restore, rollback, monitoring, and incident procedures are proven.
- [ ] [OWNER] Business, technical, security, and production owners approve the release.

## Required verification for every stabilization slice

Run the narrowest relevant tests during implementation, followed by:

```powershell
npm test
npm run lint
npm run build
git diff --check
git status --short
```

Also inspect the final diff for secrets, generated files, unrelated changes, weakened assertions, client-only authorization, and documentation that overstates environment evidence.
