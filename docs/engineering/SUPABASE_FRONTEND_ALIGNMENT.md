# Frontend–Supabase alignment

Status: audited against the frontend source and versioned migrations on 2026-09-23. The live hosted schema was not re-queried during this audit because the Supabase CLI/connector was unavailable in the environment. Historical staging-application claims in `SECOND_BRAIN.md` therefore remain historical evidence, not a new remote verification.

## Verdict

The connection architecture is structurally sound:

- the browser receives only the public Supabase URL and publishable key;
- Supabase Auth establishes the identity used by Postgres RLS;
- shared editable state crosses one `applicationRepository` boundary;
- normalized import tables remain a read-only audit/reference layer;
- `app_profiles` carries authorization attributes;
- `application_records` carries per-entity JSON payloads;
- Realtime messages are invalidation signals and clients refetch through RLS;
- the 19 frontend record types exactly match the latest versioned database check constraint.

The system is **not yet fully semantically aligned for production**. Three frontend capabilities are broader than the current database policies: company-wide aggregate Analytics for lower ranks, delegated document renewal, and non-Admin archive mutations. These gaps are described below and must not be solved by exposing unrestricted raw response or registry rows.

## Connection and trust flow

```text
Express /api/config or Vite public environment variables
                  |
                  v
        src/services/supabaseClient.ts
                  |
                  v
       Supabase Auth session (@mgenesis.com)
                  |
                  v
 applicationRepository / typed feature services
                  |
                  v
       PostgREST + Postgres RLS policies
          |                       |
          v                       v
 app_profiles              application_records
 authorization             editable UI records
                                  |
                                  v
                    Realtime invalidation event
                                  |
                                  v
                         RLS-protected refetch
```

Security boundary: React route visibility and TypeScript types are usability controls. Supabase RLS is the authorization boundary. Realtime payloads are never accepted as trusted application data.

## Configuration contract

| Setting | Consumer | Semantics |
|---|---|---|
| `VITE_SUPABASE_URL` | `supabaseClient.ts`, `/api/config` | Public project API URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `supabaseClient.ts`, `/api/config` | Browser-safe publishable/anon key only. Never use a service-role key. |
| `VITE_DEPLOYMENT_ENV` | evaluation submission provenance | Defaults to staging; only an approved production deployment may use `production`. |

`src/main.tsx` requests `/api/config` before dynamically importing the application, allowing runtime public configuration. Static hosting falls back to Vite build-time variables. An unconfigured client uses a harmless placeholder, while repository/auth methods reject operations through `isSupabaseConfigured` checks.

Do not place database passwords, JWT signing secrets, or service-role keys in any `VITE_*` variable or runtime response.

## Data ownership

### Normalized import/audit layer

`companies`, `company_branches`, `company_documents`, `evaluation_forms`, and `evaluation_questions` are read-only reference tables for authenticated confirmed company users. `loadNormalizedPartnerCompanies()` is a fallback only when no editable `partner_company` application records are visible.

The frontend must not write normalized import tables. Import tooling and reviewed migrations own that layer.

### Editable application layer

`app_profiles` stores email, role, designation, department, and optional account permission overrides. `application_records` uses `(record_type, record_id)` as its primary key and stores one JSON object per editable entity.

| Record type | Stable ID | Read boundary | Write boundary |
|---|---|---|---|
| `partner_company` | company ID | confirmed authenticated users | Admin only |
| `survey` | survey ID | confirmed authenticated users | Admin only |
| `survey_response` | `responseId:questionId` | Admin; Managerial/Director/Executive; Supervisory department; owner/email | Admin, or authenticated user inserting their own response |
| `archive_series` | series ID | confirmed authenticated users | Admin only |
| `department_permission` | department | confirmed authenticated users | Admin only |
| `category_labels` | `global` | confirmed authenticated users | Admin only |
| `feedback_contact` | contact ID | Admin or Supervisory+ | Admin or Supervisory+ |
| `feedback_report` | report ID | Admin or Supervisory+ | Admin or Supervisory+ |
| `feedback_settings` | `global` | Admin or Supervisory+ | Admin or Supervisory+ |
| `document_notification_rule` | rule ID | confirmed authenticated users | Admin only |
| `notification_read_state` | authenticated user UUID | owning user | owning user |
| `admin_activity` | activity ID | Admin only | Admin only |
| `document_modification` | modification ID | confirmed authenticated users | Admin, or authenticated actor inserting their own entry |
| `export_history` | export ID | owning user | owning user |
| `supplier_ranking_history` | log ID | Admin only | Admin only |
| `employee_notification_state` | state ID | owning user | owning user |
| `reminder_settings` | settings ID | confirmed authenticated users | Admin only |
| `compliance_snapshot` | snapshot ID | confirmed authenticated users | Admin only |
| `active_company_snapshot` | type/timestamp/UUID | Admin only | Admin only |

The canonical list is exported as `APPLICATION_RECORD_TYPES` from `applicationRepository.ts`. A focused automated test compares it with the latest migration constraint.

## Feature-to-service alignment

| Frontend area | Service boundary | Backend source |
|---|---|---|
| Authentication | `supabasePasswordAuth.ts` | Supabase Auth |
| Profiles and account overrides | `applicationRepository.ts` | `app_profiles` |
| Partner Companies and documents | `useSurveyData.ts` | `application_records/partner_company`; normalized fallback on an empty projection |
| Surveys, responses, archives, categories | `useSurveyData.ts` | corresponding `application_records` types |
| Active Companies upload/history | `features/active-companies` | `application_records/active_company_snapshot` |
| Feedback Hub | `feedbackHubStore.ts` | feedback record types |
| Notification read state | dedicated repository functions | owner-scoped `notification_read_state` |
| Operational settings/history | focused utilities plus `sharedStoreHydration.ts` | corresponding application record types |

Active-company uploads contain only source metadata and a deduplicated `companies: string[]` snapshot. They do not write `partner_company` or `survey_response` and therefore cannot create leaderboard evaluations.

## Realtime alignment

`subscribeToApplicationChanges()` subscribes to `application_records` and `app_profiles`. It emits only a record type or profile-change signal; consumers then perform a normal RLS-protected query.

- Core survey/partner/category stores refresh in `useSurveyData.ts`.
- Profiles and department permissions refresh in `App.tsx`.
- Operational stores refresh through `sharedStoreHydration.ts`.
- An open Active Companies viewer refreshes its snapshots directly through its feature service.

Debouncing is used for the large core hydration path. Feature-specific refreshes remain scoped to their record type.

## Confirmed semantic gaps

### 1. Aggregate Analytics versus raw response RLS — high priority

The frontend intends Analytics to be company-wide and aggregate-only for every rank. The current frontend hydrates Analytics from `survey_response` rows already filtered by RLS. Supervisory users therefore receive only their department, and Rank & File users receive only their own submissions; the client cannot reconstruct a company-wide aggregate from rows it never receives.

Required resolution: expose a security-definer aggregate RPC or protected aggregate view returning only approved grouped metrics, then use it for lower-rank Analytics. Do not broaden raw `survey_response` SELECT access merely to make the charts company-wide.

### 2. Delegated document renewal versus `partner_company` UPDATE RLS — high priority

The frontend supports a `renew-documents` permission for non-Admins, but document changes are persisted by updating a `partner_company` record. The consolidated UPDATE policy allows that record type only to Admins, so a delegated user's local optimistic edit is rejected by Supabase.

Required resolution: model an effective server-side permission that RLS can evaluate, or provide a narrowly validated renewal RPC. The RPC should permit only document/status fields and should write the modification audit record atomically.

### 3. Archive module versus response UPDATE/DELETE RLS — high priority

Managerial and Director defaults include Archive Center, but existing `survey_response` rows can be updated or deleted only by an Admin. Archive, restore, and archive deletion operations therefore fail remotely for non-Admin users even when the module is visible.

Required resolution: decide whether Archive Center is Admin-only or add a server-side archive operation with explicit authorization and field-level validation. Do not grant unrestricted response UPDATE/DELETE.

### 4. Optimistic cache can temporarily disagree after a rejected write — medium priority

Several UI actions update React/local cache first and persist in the background. Failures emit `supabase-persistence-error`, but the optimistic value can remain visible until the next authoritative hydration.

Required resolution: for authorization-sensitive mutations, await the remote result before reporting success, or roll back/refetch on failure.

### 5. Runtime payload validation is uneven — medium priority

The generic repository verifies only that a payload is a JSON object. Some feature boundaries perform stronger parsing, but the core Partner Company, survey, and response records rely mainly on normalization and TypeScript assertions.

Required resolution: add runtime schemas/parsers for every untrusted application record before expanding production use.

### 6. Microsoft-to-Supabase bridge failure leaves no database session — low while Microsoft login is disabled

The optional Microsoft flow establishes the frontend identity before the best-effort Supabase ID-token exchange finishes. If that exchange fails, RLS-backed hydration cannot succeed. Microsoft login is currently unavailable by product decision, so this is dormant.

Required resolution before enabling Microsoft login: treat a successful Supabase session exchange as part of authentication completion, or show a blocking connection error.

## Verification procedure

Local/code verification:

```powershell
npm test
npm run lint
npm run build
```

Remote staging verification, when the approved Supabase CLI or connector is available:

1. Compare applied migration versions with `supabase/migrations/`.
2. Confirm `application_records_record_type_check` matches `APPLICATION_RECORD_TYPES`.
3. Confirm RLS is enabled on `app_profiles` and `application_records`.
4. Confirm anon has no privileges on either table.
5. Confirm both tables are in `supabase_realtime`.
6. Exercise read/write negative cases using Admin, Supervisory, Rank & File, delegated-renewal, and archived-response scenarios.
7. Verify a failed write never produces a durable success state in the UI.

Production must be checked independently. Staging evidence must not be treated as proof of production state.

## Change checklist

Whenever a frontend record type or persistence behavior changes:

1. Update `APPLICATION_RECORD_TYPES`.
2. Add a versioned migration updating the database constraint and RLS.
3. Add runtime parsing for the payload.
4. Add the correct hydration/realtime route.
5. Test permitted and denied roles.
6. Update this document and `SECOND_BRAIN.md` if the architectural fact changed.
7. Apply migrations only with explicit authorization and a rollback/recovery plan.
