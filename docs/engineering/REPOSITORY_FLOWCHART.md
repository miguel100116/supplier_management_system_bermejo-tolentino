# Supplier Management System Flowchart

This diagram reflects the current codebase as of 2026-09-22. It distinguishes the editable application store from the normalized import/audit tables; the latter are not the normal UI write target.

```mermaid
flowchart TD
  User[Employee or Administrator] --> Browser

  subgraph Host[Node host]
    Browser -->|HTTP| Express[Express server.ts]
    Express -->|development| Vite[Vite middleware]
    Express -->|production| Static[Built SPA assets]
    Browser -->|GET /api/config| RuntimeConfig[Public runtime configuration]
    Browser -->|GET /api/health| Health[Health response]
  end

  subgraph Client[React single-page application]
    RuntimeConfig --> Main[src/main.tsx]
    Main -->|configure MSAL then render| App[src/App.tsx]
    App --> Auth{Authenticated?}
    Auth -->|No| Login[LoginPage]
    Auth -->|Yes| Bootstrap[Load profile, permissions and shared stores]
    Bootstrap --> RBAC[RBAC: role, designation, department, overrides]
    RBAC --> Scope[Response scope and permitted survey types]
    Scope --> Shell[Shell: navigation, header, account and notification controls]
    Shell --> Pages[Route-level page components]

    Pages --> SurveyFlow[Survey forms and submissions]
    Pages --> PartnerFlow[Partner registry and document tracker]
    Pages --> InsightFlow[Dashboard, analytics, explorer, archive]
    Pages --> OutputFlow[Reports, presentation and feedback hub]
    Pages --> AdminFlow[Accounts, categories, rankings and imports]

    SurveyFlow --> Store[useSurveyData: in-memory UI state]
    PartnerFlow --> Store
    InsightFlow --> Store
    OutputFlow --> Store
    AdminFlow --> Store
    Store --> Domain[Pure domain utilities: scoring, analytics, compliance, imports, exports]
  end

  subgraph Security[Authentication and authorization]
    Login -->|email/password, @mgenesis.com only| SupabaseAuth[Supabase Auth]
    Login -. optional Microsoft path .-> MSAL[Microsoft Entra / MSAL]
    App --> Idle[30-minute inactivity timeout\nand cross-tab activity state]
    Idle -->|timeout or sign out| Logout[Clear local account and sign out providers]
    SupabaseAuth --> RLS[RLS-protected database operations]
  end

  subgraph Supabase[Supabase staging]
    RLS --> Profiles[app_profiles\nroles and permission overrides]
    RLS --> Records[application_records\neditable shared UI data]
    Records --> Realtime[Realtime change notification]
    Realtime -->|invalidate then refetch| Bootstrap
    Normalized[Normalized companies/forms/submissions/answers\nimmutable import and audit layer] --> Adapter[normalizedPartnerCompanies adapter]
    Adapter --> Store
  end

  subgraph Local[Browser-local state]
    Cache[Authenticated startup cache] --> Store
    Drafts[Survey drafts and display preferences] --> Store
    ReadState[Per-user notification read-state cache] --> Store
  end

  subgraph External[Optional external services]
    OutputFlow -->|delegated Mail.Send| Graph[Microsoft Graph sendMail]
    Domain --> Downloads[PDF, XLSX, CSV, PPTX and DOCX generation/download]
  end
```

## Main business workflows

```mermaid
flowchart LR
  subgraph Evaluation[Evaluation lifecycle]
    A[Admin creates or manages a form] --> B[Employee opens an allowed form]
    B --> C[Validate answers and save draft locally]
    C --> D[Submit one response record per question]
    D --> E[Persist survey_response records through RLS]
    E --> F[Realtime invalidation and refetch]
    F --> G[Scoring and analytics utilities]
    G --> H[Dashboard, charts, ranking, explorer and reports]
    H --> I[Admin archives a reporting series]
  end

  subgraph Compliance[Partner and compliance lifecycle]
    J[Admin manages partner/branch/documents] --> K[Document requirements and expiry calculation]
    K --> L[Compliance status, reminders and notifications]
    L --> M[Persist partner_company and operational-history records]
    M --> F
  end

  subgraph Import[Import lifecycle]
    N[CSV/XLSX or source data] --> O[Import parser and validation]
    O --> P{Reviewed and accepted?}
    P -->|No| Q[Show errors or preview; no write]
    P -->|Yes, staging import tooling| R[Normalized Supabase import/audit tables]
    P -->|Yes, in-app registry import| M
    R --> S[Normalized-company adapter]
    S --> K
  end

  subgraph Delivery[Report and partner-feedback lifecycle]
    H --> T[Build report DTO from company ID, form and scoped responses]
    T --> U[Generate PDF/other export]
    U --> V{Send to partner?}
    V -->|No| W[Download export]
    V -->|Yes, Microsoft configured| X[Microsoft Graph mail]
    X --> Y[Persist report history/status]
    Y --> F
  end
```

## Key boundaries

- `src/App.tsx` owns client-side page selection, access filtering, authentication bootstrap, and Supabase-triggered refresh orchestration.
- `src/hooks/useSurveyData.ts` is the central client data store. Its shared records persist via `src/services/applicationRepository.ts`.
- Supabase RLS, rather than hidden navigation or TypeScript types, is the database authorization boundary.
- `application_records` is the editable, UI-facing shared store. The normalized tables are the staging import/audit layer.
- Local storage is intentionally limited to cache and device-specific state; it is not the shared source of truth when Supabase is configured.
- Microsoft Graph email is optional and only reports success after Graph accepts the send request.
