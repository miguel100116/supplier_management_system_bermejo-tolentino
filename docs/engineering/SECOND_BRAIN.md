# Supplier Management System — Engineering Second Brain

Last verified: 2026-09-11

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

- Microsoft Entra ID authentication through MSAL.
- Microsoft Graph delegated email sending.
- Supabase client, response mirror, SQL schema, seed administration, and row-level-security policies.
- CSV/XLSX imports and PDF, PPTX, Word, CSV, and spreadsheet exports.

### Current persistence model

- Much of the application state is stored in browser `localStorage`.
- Survey response writes can be mirrored to Supabase, but comments in `src/hooks/useSurveyData.ts` and `src/services/supabaseResponses.ts` identify browser storage as the current source of truth.
- This is unsuitable as the long-term multi-user system of record because clients can diverge and browser data lacks centralized durability and auditing.
- Any migration away from browser storage must define one canonical backend source, compatibility behavior, validation, rollout, and recovery.

### Authorization

- UI access is derived from role, designation, department, and overrides.
- Microsoft identity and Supabase sessions are integrated in the frontend.
- The database schema enables RLS and defines scoped policies.
- `supabase/schema.sql` currently contains clearly labeled temporary anonymous response policies. They are a production blocker if enabled.

## Current repository health

Verified on 2026-09-11:

- `npm run lint` succeeds, but the script is only `tsc --noEmit`; ESLint is not configured.
- A focused Node test harness (`npm test`) covers the Feedback Hub company-report domain; broader unit, component, integration, and end-to-end coverage is not yet established.
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

## Active modernization state

- Agent governance: established by `AGENTS.md`.
- Automated test harness: focused Feedback Hub company-report tests established; repository-wide coverage remains incomplete.
- CI/CD workflow: not established.
- Feature-module refactor: not started by this governance change.
- Backend source-of-truth migration: not started by this governance change.
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
