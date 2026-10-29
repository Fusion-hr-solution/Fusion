---
name: tenant-record-redesign
description: "Platform tenant record (/platform/tenants/{id}) — 4-tab frame; all tab bodies built 2026-10-26 (B-120) + archive (B-099)"
metadata: 
  node_type: memory
  type: project
  originSessionId: d1024ed0-4ede-4c91-8785-a4eeeb6db030
  modified: 2026-09-11T14:27:52.833Z
---

Redesign of the Platform tenant record at `/platform/tenants/{tenantId}` (platform MFE), driven by `C:\Users\wsmtr\Downloads\fusion-platform-tenant-record-spec.md` (product authority) and a header reference image. Started 2026-09-11; uncommitted on branch `wassim/develop`.

**Done — the shared frame (top of page):**
- IA collapsed from six destinations to **four**: Overview, Access, Products, Activity (spec §6). `RECORD_DESTINATIONS` in `features/tenants/record/record-routes.ts` (dropped the `icon` field). Route dirs `entitlements/operations/audit/settings` deleted; `products/` + `activity/` added (all route `page.tsx` currently `return null`).
- `record-shell.tsx` `RecordHeader`: monogram + name + lifecycle `StatusBadge` (**always "Active"/success** — the data model has only `administratorActivationStatus`, no Deactivated lifecycle yet, so every existing tenant is Active; admin-handoff state was deliberately moved OUT of the header into the future Overview body per spec §5/§7.2) + copyable tenant **slug** as the key (`TenantKey`, replaces the old UUID/created/provisioned-by strip). Nav = text-only underline tab strip (amber `border-primary` active), no icons — reference had none.
- `layout.tsx` restored to mount `TenantRecordShell` (loads tenant once via `useTenantDetail`, shares via `RecordContext`).
- **No back button** (removed per user; the top-bar breadcrumb Tenants > … still returns). Larger sizing to match a header reference image: monogram `size-16`, name `text-3xl`.
- Overflow `•••` (bordered `Button variant=outline size=icon`, top-right `self-start`) → **lifecycle-only DropdownMenu**, now **fully wired to a real backend**. Active tenant → "Deactivate tenant" (destructive) behind an AlertDialog confirm; deactivated → "Reactivate tenant" (direct). Header badge = `tenant.isActive` (Active/success vs Deactivated/neutral).

**Backend lifecycle (Identity, built + e2e-verified 2026-09-11):** the domain already had `Tenant.IsActive` + `Deactivate()`/`Reactivate()`; enforcement already existed via `TenantContext/TenantOperationalStatus` (`!IsActive` ⇒ Suspended). Added: `TenantDetailDto.IsActive` (projection); `ITenantLifecycleService`/`TenantLifecycleService` (transaction, `IgnoreQueryFilters` load, domain transition, audit event, save) registered in `ServiceCollectionExtensions`; `POST /api/identity/platform-admin/tenants/{id}/deactivate|reactivate` on `PlatformTenantsController` (404 `tenant.not_found`, 409 `tenant.invalid_lifecycle_state`); two new `TenantBootstrapAuditEventType` values `TenantDeactivated=8`/`TenantReactivated=9` (**no migration** — IsActive column pre-existed, only appended enum values). Frontend: `deactivateTenant`/`reactivateTenant` in api.ts, `useTenantLifecycle` in queries.ts (invalidates `tenantKeys.all`), `isActive` on `TenantDetail` + fixtures. Rendered cycle Active→Deactivated→Active verified on Acme Corp via shell :3000; 135 FE tests + Identity build green.

**Verification:** platform `next build` (lint+types) green; `record-routes.test.ts` updated to the 4 labels, 12/12 pass; rendered through shell :3000 (Acme Corp) light/dark/narrow + destination switches — see [[rendered-verification-playwright]].

**Overview body (right rail):** `tenant-profile.tsx` `TenantProfile` — Tenant profile card (Organization name / Default timezone / Default locale / Provisioned). **Primary country deliberately omitted** — not captured at provisioning nor stored on the tenant; would be fabrication. Edit → rename dialog wired to a **real backend**: `Tenant.Update(name)` (slug untouched) via new `ITenantProfileService.RenameAsync` + `POST /api/identity/platform-admin/tenants/{id}/rename` (404 `tenant.not_found`, 400 `tenant.invalid_name`), audit `TenantProfileChanged=10`; FE `renameTenant`/`useRenameTenant` + `toast`. Rendered + rename cycle verified on Acme Corp (renamed→restored). NOTE: this file's Overview grid is **co-edited by a concurrent forked session** ("Platform tenants overview redesign") building `products-summary.tsx` `TenantProducts` (placed in the LEFT column); profile went RIGHT — merge carefully / re-read before editing `overview-page.tsx`.

`recent-activity.tsx` `RecentActivity` — right rail under profile: connected-dot timeline of `tenant.history` (first 5), title (`eventTitle`) + relativeFromNow + a truthful per-event-type description (no fabricated recipient/module specifics), failure rows destructive, "View activity" → Activity destination. Added `TenantProfileChanged` to `EVENT_TITLE`. Overview right rail now = Profile + Recent activity; left = Admin handoff + Products (Products owned by the concurrent forked session).

**Pending:** the tab bodies (Overview first — spec §8 / §18 freshly-provisioned demo state is the first target), then Access/Products/Activity. Feature components under `features/tenants/record/*` (access-page, entitlements-page, etc.) remain on disk as reference but are unused by routes; they still import `useTenantRecord`/`TenantIdentifier` from record-shell, so keep those exports.

**2026-10-26 update (B-120 + B-099, committed `2e074df4`, `0eb073ad`):** Access / Products / Activity tabs built (`access-page.tsx`, `products-page.tsx`, `activity-page.tsx`, `ActivityTimeline` in recent-activity), en/fr/ar. Tenant archival: `POST .../tenants/{id}/archive`, archived tenants hidden from the list (no filter; record by URL), archived record shows badge/banner and no actions. The old unrouted reference components were deleted. Changing products after provisioning is B-124 (entitlements ride the sign-in token). The "Pending" note above about reference components is obsolete.
