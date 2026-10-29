---
name: local-dev-auth
description: How to log into the running Fusion stack locally — durable facts only (creds move; ask the user)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 403ef6f4-43b4-43d7-b749-adbcdae4e333
  modified: 2026-09-16T18:09:14.208Z
---

Local dev login for the Fusion frontend. **Credentials move constantly — do NOT memorize specific tenant accounts as permanent.** Only two things are fixed:

- **Platform Admin:** `admin@ey-hr.com` / the local password (`FUSION_LOCAL_PASSWORD`) (as of the 2026-10-14 and 2026-10-16 resets; the authoritative value is in `.local-docs/agents/data/README.md`). On an empty Identity database it is created only via the Development bootstrap settings (`DevelopmentBootstrap__PlatformAdmin__Email` / `__Password`, `DevelopmentPlatformAdminBootstrap.cs`). The password is NOT the email. This account is fenced OUT of Core HR and tenant campaign UI, so it can't verify tenant-scoped surfaces.
- **Invitee password convention:** any account provisioned via the invite→accept flow uses the local password (`FUSION_LOCAL_PASSWORD`). So for a current tenant user, the password is almost always that; the *email/tenant* changes per session.

For any specific tenant-scoped login (HR admin / manager / employee), **ASK the user for the current accounts** — they reseed tenants often. Never try memorized tenant emails, and never reset a password in the identity DB ([[dont-reset-demo-passwords]]).

Durable technical facts:

- **Auth is origin-scoped** (localStorage `ey_hr_auth`). Each MFE port is a separate origin, so a login at the shell (`:3000`) does NOT carry to `core` (`:3002`) / `performance` (`:3004`) hit directly. Core/Perf have **no own `/auth/signin`** (404s).
- **Always access modules through the shell origin:** log in at `http://localhost:3000/auth/signin`, then open `http://localhost:3000/core`, `/performance`, etc. Hitting `:3002`/`:3004` directly shows "No workspaces available / Sign in".
- **Playwright login:** after `networkidle`, wait ~2.5s for hydration before clicking submit, or the click is dropped.
- **Self-service endpoint split:** the auth user carries `employeeId` (uuid). CoreHR self endpoints split — `/corehr/employees/by-key/{stableEmployeeKey}/...` (profile/reporting-lines) vs `/corehr/workforce/me` and `/corehr/workforce/employees/{id}/team` (by uuid id). Passing the uuid to a `by-key` route 404s.
