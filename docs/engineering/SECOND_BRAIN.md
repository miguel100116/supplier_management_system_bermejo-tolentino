# Supplier Management System — Engineering Second Brain

Last verified: 2026-09-17

This document preserves durable engineering context for maintainers and coding agents. It is a map, not a substitute for reading the relevant code. Verify details before making consequential changes.

## Product intent

The Supplier Management System is an internal application for evaluating and managing Couriers, Suppliers, and Subcontractors. It covers surveys, analytics, rankings, compliance documents, imports, report generation, feedback delivery, account access, and archiving.

Canonical product documentation:

- `README.md` — product scope, architecture, modules, setup, and known issues.
- `SYSTEM_TURNOVER.md` — operational handoff and current implementation status.
- `docs/Admin_Manual.docx` and `docs/Employee_Manual.docx` — role-specific user manuals.

## Verified system map

### Runtime

- React 18 and TypeScript frontend built with Vite 6.
- Tailwind CSS for styling and Recharts for analytics visuals.
- Thin Express host in `server.ts` for Vite development middleware, runtime public configuration, health checks, and production static serving.
- `server/index.js` is a second, overlapping server implementation and should be treated as legacy until its consumers are verified.
- Main commands are declared in `package.json`: `dev`, `build`, `start`, `preview`, and `lint`.

### External boundaries

- Supabase email/password authentication is active for staging. Microsoft Entra ID code remains present but is unavailable without Azure tenant access.
- Microsoft Graph delegated email sending.
- Supabase client, response mirror, SQL schema, seed administration, and row-level-security policies.
- Supabase CLI local configuration is initialized in `supabase/config.toml` and linked to the dedicated `supplier-management-staging` project (`adxwaxhnqxpmgjvsxgug`). The additive normalized migration and reviewed data import were applied there on 2026-09-16. Remote lint passed; repeat import and reconciliation preserved the expected counts with zero duplicates and zero broken relationships. Production remains untouched.
- CSV/XLSX imports and PDF, PPTX, Word, CSV, and spreadsheet exports.

### Current persistence model

- Authenticated staging users load and save profiles, department permissions, surveys, Partner Companies/documents, evaluation responses, archives, category labels, Feedback Hub contacts/reports/settings, and document-notification rules through Supabase.
- Imported normalized tables remain the immutable source/audit layer. `app_profiles` and per-entity `application_records` are the canonical editable frontend store.
- Browser `localStorage` remains a startup/demo cache and stores device-specific drafts/preferences plus lightweight audit/export logs that have not yet been approved for cross-device sharing.
- This is unsuitable as the long-term multi-user system of record because clients can diverge and browser data lacks centralized durability and auditing.
- Any migration away from browser storage must define one canonical backend source, compatibility behavior, validation, rollout, and recovery.

### Authorization

- UI access is derived from role, designation, department, and overrides.
- Supabase password identity and session restoration are integrated in the frontend; localStorage is not trusted as identity when Supabase is configured.
- The applied database schema enables RLS. Shared reference records are readable by confirmed `@mgenesis.com` users; application configuration/registry writes are Admin-only; employees may insert only their own evaluation rows; response reads are scoped by role, department, or ownership.
- `supabase/schema.sql` currently contains clearly labeled temporary anonymous response policies. They are a production blocker if enabled.

## Current repository health

Verified on 2026-09-16:

- `npm run lint` succeeds and runs TypeScript checks for both application and import scripts; ESLint is not configured.
- `npm test` passes 28 focused tests covering Feedback Hub report data, application persistence identifiers, normalized Partner Company mapping, and the Supabase import pipeline; broader component, integration, and end-to-end coverage is not yet established.
- No repository CI workflow is present.
- The TypeScript source under `src/` is roughly 65,000 lines across about 100 files.
- Major concentration points include `src/hooks/useSurveyData.ts`, `src/App.tsx`, several page components above 1,000 lines, and a very large generated/static partner seed file.
- `.vite/` cache files are tracked despite being generated artifacts.
- Root-level extraction scripts, generated text, screenshots, forms, and data exports make source ownership and release contents less clear.
- The working tree contained pre-existing uncommitted application and configuration changes when these agent rules were added. Every task must refresh `git status` and preserve unrelated work.

## Architectural pressure points

1. **Source of truth** — browser-first persistence and best-effort backend mirroring can cause inconsistent multi-user data.
2. **Large orchestration units** — central hooks and pages mix state, business rules, persistence, and presentation, increasing regression risk.
3. **Business-rule duplication** — scoring, RBAC, filtering, reporting, and status rules need canonical domain modules.
4. **Boundary validation** — CSV/XLSX, browser storage, auth claims, Supabase rows, and API responses require runtime validation.
5. **Delivery confidence** — missing automated tests and CI leave type checking and manual testing as the primary gates.
6. **Repository hygiene** — generated artifacts, large data files, and duplicate server entry points obscure the deployable product.

## Target direction

These are engineering guidelines, not a completed design decision:

- Move incrementally toward feature-oriented modules under `src/features/`.
- Keep pure domain rules independent of React and infrastructure.
- Put external systems and browser APIs behind typed adapters.
- Make Supabase or another approved backend the single durable source of truth before production rollout.
- Establish a test pyramid using a TypeScript-compatible unit/component runner plus a small end-to-end suite.
- Establish pull-request CI with clean install, type check, lint, tests, production build, and security checks.
- Remove generated caches and sensitive/business exports from source control, with curated anonymized fixtures where tests require data.

## Modernization sequence

Use small vertical slices; preserve working behavior throughout.

1. Establish baseline tests around scoring, RBAC, imports, compliance dates, and the most critical user journeys.
2. Add reproducible quality scripts and pull-request CI.
3. Define typed repository interfaces around current persistence and external services.
4. Extract pure domain logic from `useSurveyData`, `App.tsx`, and large pages behind characterization tests.
5. Move one feature at a time into feature modules, keeping public APIs small.
6. Migrate to one backend source of truth with tested data migration and rollback.
7. Harden RLS, remove temporary anonymous access, and validate authorization at the data boundary.
8. Consolidate the server entry point and clean generated or obsolete repository artifacts.

This order may change when product risk or user priorities justify it. Record an approved change below.

## Decision log

Use short entries with this shape:

```text
YYYY-MM-DD — Decision title
Status: proposed | accepted | superseded
Context: why a decision was needed
Decision: the chosen direction
Consequences: tradeoffs and follow-up work
Evidence: links to code, issue, PR, or ADR
```

### 2026-09-10 — Repository-wide agent operating agreement

Status: accepted

Context: The project needs consistent agent behavior for safe refactoring, modular design, testing, CI/CD, security, and durable context retention.

Decision: Use the root `AGENTS.md` as the authoritative repository rule set and this document as maintained project memory.

Consequences: Agents must follow the engineering loop, preserve unrelated work, verify changes proportionately, and keep this document current when durable project facts change.

Evidence: `AGENTS.md`

### 2026-09-10 — Preserve the existing UI during modular refactoring

Status: accepted

Context: Modularization is intended to improve internal maintainability without changing the established user experience.

Decision: Refactoring tasks must preserve the rendered UI and interaction behavior. Any redesign or visible change requires separate, explicit user authorization and visual verification.

Consequences: Agents should baseline relevant desktop and mobile states before UI-adjacent refactors, retain existing markup and styling where practical, and report the visual comparison performed.

Evidence: `AGENTS.md`, section "Refactoring rules"

### 2026-09-11 - Canonical Feedback Hub company-report boundary

Status: accepted

Context: Feedback Hub PDF generation previously selected companies by display name and assembled report data in multiple UI paths, which could mix companies or survey templates.

Decision: Use `src/features/feedback-hub/reporting/` as the typed source for survey-template mapping, company-ID resolution, response scoping, category metrics, rating bands, and report DTO construction. New response and queued-report records retain both survey and company IDs; ambiguous legacy name-only rows must stop report generation.

Consequences: Preview, print, queue, revision, and bulk generation share one report-data contract. The Word files remain visual references only; generated PDFs use current application data. Any future template or scoring change should update this module and its focused tests.

Evidence: `src/features/feedback-hub/reporting/`, `src/utils/companyReportExport.ts`, `src/features/feedback-hub/reporting/companyReportData.test.ts`

### 2026-09-15 - Additive normalized CSV import boundary

Status: accepted for local preparation; not applied to Supabase

Context: The four production CSV files and the accessible live PostgREST schema do not fit the legacy one-table response mirror or the stale draft schema without losing Master List document fields and canonical question relationships.

Decision: Keep the live `suppliers` and `survey_responses` tables untouched. Prepare additive normalized company, branch, document, form, question, submission, and answer tables in `supabase/migrations/202609150001_normalized_business_data.sql`. Import through deterministic IDs and UPSERTs, with a mandatory dry run and human-reviewed resolutions for unresolved company names. A reviewed resolution may target an existing Master List BP Code or preserve a genuinely distinct evaluation-only company without inventing a BP Code.

Consequences: The import is repeatable and preserves raw source values alongside parsed fields. The reviewed local resolution file is ignored by Git and produces a zero-blocker dry run. The normalized schema is present only in the dedicated staging project; no production database or UI source-of-truth change occurs until staging import and reconciliation are completed and followed by authenticated RLS policies and application service cutover.

Evidence: `scripts/supabase-import/`, `supabase/verification/normalized_import_checks.sql`, `docs/engineering/SUPABASE_NORMALIZED_IMPORT.md`

### 2026-09-16 - Supabase password-auth staging connection

Status: accepted for staging

Context: The team cannot access the Microsoft Azure tenant, so Entra authentication cannot be completed. The application also contained a local environment configuration that pointed to production and placed a service-role credential in a browser-facing variable.

Decision: Use Supabase email/password authentication for staging, restricted to `@mgenesis.com`. Point the local browser build to the dedicated staging project through an ignored `.env.local` containing only the staging publishable key. Grant authenticated read-only RLS access to normalized company/form reference tables and load Partner Companies through a typed adapter. Keep raw evaluators, submissions, answers, and all backend write paths locked pending role and write-policy design.

Consequences: Staging login and Partner Company reads no longer depend on Azure. Demo login has no remote access. Most feature state and writes remain local-only, and Microsoft Graph mail remains unavailable. The production service-role credential found in `.env` must be rotated; it is not present in the generated staging build.

Evidence: `src/services/supabasePasswordAuth.ts`, `src/services/normalizedPartnerCompanies.ts`, `supabase/migrations/202609160001_staging_email_auth_read_access.sql`

### 2026-09-16 - Canonical editable application records in staging

Status: accepted for staging

Context: Partner edits, evaluation submissions, surveys, profiles, permissions, archives, and category changes were still browser-local after the initial read-only connection.

Decision: Keep normalized import tables immutable and seed a per-entity `application_records` store for the frontend contract. Store account authorization in `app_profiles`. Use Supabase as the authenticated source of truth with local storage only as a cache/demo fallback. Enforce profile-scoped response reads, own-submission inserts, and Admin-only shared registry/configuration writes through RLS.

Consequences: The main shared business modules, Feedback Hub records, and document-notification rules now persist across devices in staging. Device drafts/preferences and lightweight audit/export logs remain local. A confirmed user must exist before authenticated writes can be tested, and an approved profile must be promoted to Admin before shared registry/configuration edits can succeed.

Evidence: `src/services/applicationRepository.ts`, `src/hooks/useSurveyData.ts`, `src/App.tsx`, `src/utils/feedbackHubStore.ts`, `src/utils/documentNotificationSettings.ts`, `supabase/migrations/202609160002_application_persistence.sql`, `supabase/migrations/202609160003_secondary_shared_modules.sql`, `supabase/verification/application_persistence_checks.sql`

## Active modernization state

- Agent governance: established by `AGENTS.md`.
- Automated test harness: focused Feedback Hub company-report tests established; repository-wide coverage remains incomplete.
- CI/CD workflow: not established.
- Feature-module refactor: not started by this governance change.
- Backend source-of-truth migration: core shared business modules, Feedback Hub data, and document-notification rules use the staging application store with RLS; audit/export logs remain local pending an explicit sharing requirement.
- Repository artifact cleanup: not started by this governance change.

## Handoff template

Add a temporary handoff only for substantial unfinished work, then remove it when resolved:

```text
Task:
Outcome/acceptance criteria:
Files intentionally changed:
Checks run and results:
Decisions made:
Known risks or blockers:
Exact next step:
```
