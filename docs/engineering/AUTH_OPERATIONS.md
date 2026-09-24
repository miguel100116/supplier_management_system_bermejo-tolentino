# Authentication and account operations

Status: repository procedure as of 2026-09-24. Hosted configuration and production-provider approval remain environment-owner responsibilities.

## Supported repository behavior

- Password authentication accepts only normalized, confirmed `@mgenesis.com` identities.
- Password reset sends Supabase's recovery email and handles the recovery callback in the application before accepting a new password.
- Passwords must be at least eight characters in the client; hosted password policy remains authoritative.
- Microsoft sign-in is never considered complete unless the Microsoft ID token is successfully exchanged for a Supabase session. When Microsoft public configuration is absent, the option remains disabled.
- Logout clears the application identity and signs out the active Supabase and Microsoft providers. A 30-minute inactivity boundary is synchronized across browser tabs.
- Database RLS and the confirmed profile are the authorization boundary; navigation visibility is not authorization.

## Account lifecycle

1. **Provision:** an authorized identity administrator creates or invites the company-domain user in the approved provider. An Admin then creates the matching `app_profiles` row through Account Management with the least-privilege role, designation, department, page permissions, and survey-type permissions.
2. **Confirm:** the user completes the provider's email/identity confirmation. Unconfirmed or non-company identities must not receive database access.
3. **Promote or change access:** an Admin changes the profile through the application. Review the requested access and keep Archive Center Admin-only. Database policies remain decisive even if stale UI state exists.
4. **Suspend:** disable or revoke the provider account/session first, then remove or reduce the profile permissions. Verify with a fresh session; hiding the account in the UI is insufficient.
5. **Recover password:** use **Forgot password** on the sign-in page. The hosted redirect allowlist must contain the deployed application recovery URL. After a successful update, the application signs the user out and requires a fresh sign-in.
6. **Emergency Admin recovery:** two authorized operators verify the incident and environment, restore access through the hosted identity console, and then create or repair the least-privilege Admin profile. Record the action outside the application according to the incident process. Never add a browser passcode, hard-coded account, service-role key, or temporary anonymous database policy.

## Required environment checks before production

- Approve one production identity model and its owners.
- Configure and test the exact recovery redirect URLs.
- Enable hosted leaked-password protection when the plan supports it, or formally approve a time-bounded compensating control.
- Test confirmation, suspension, recovery, revoked sessions, disabled accounts, multi-tab logout, and emergency recovery in staging.
- Inspect production independently; do not copy staging conclusions.
