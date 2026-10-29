---
name: invite-surfaces-unified
description: Workforce /invite/accept page rebuilt to match the redesigned /activate-invitation surface via shared @repo/ds/shell components
metadata: 
  node_type: memory
  type: project
  originSessionId: 71256bf9-6d5b-40e3-b83a-1bfc4c476b04
  modified: 2026-09-15T12:32:04.605Z
---

The two invitation-acceptance surfaces now share one composition (2026-09-15, uncommitted on `wassim/develop`).

Fusion has two invite links: **admin/bootstrap** email → `/activate-invitation?credential=` (shell app, `tenant-activation` backend — the redesigned/liked page) and **workforce** email ("Activate your Fusion access") → `/invite/accept?token=` (core app, token `invites` backend). Confirmed via Mailpit: admin=credential link, workforce=token link. The workforce page was the old-looking one.

Both already shared the `@repo/ds/shell` **frame** (`InvitationTransactionFrame`/`…Loading`/`…TerminalFrame`/`InvitationWordmark`). Only the inner composition drifted. Fix: extracted the polished inner pieces into `@repo/ds/shell` as data-agnostic, prop-driven components and refactored BOTH pages onto them:
- `InvitationContextPanel` (eyebrow/heading/lead/rows[{icon,label,value}]/securityNote/footerLabel)
- `PasswordStrengthField` (takes `checks: {label,satisfied}[]` prop — caller computes from its own DTO; internal advisory strength meter)
- `InvitationTerminalCard` (variant resolved|error, icon, title, detail, action)

Data layers left untouched and different by design: shell uses credential + session-in-accept-response; core keeps token-in-path + `useValidateInvite`/`useAcceptInvite` + separate `apiLogin` → `persistAuth` → `resolveInviteAcceptanceDestination` + 3-step progress. Kept the workforce/admin distinction: Employee/Manager set **password only** (name from employee record), admins enter name. `apps/shell/.../activate-invitation/password-strength-field.tsx` deleted (moved to ds/shell).

Verified: type-check + lint + build green (ds/shell/core); rendered on asteria "Acme Corp" tokens from Mailpit — workforce Employee (password-only) + Manager (Access=Manager), invalid-token terminal card, `/activate-invitation` admin regression unchanged, phone width. Never submitted (would consume real tokens). Relates to [[auth-invite-surface-redesign]], [[workforce-access-activation]], [[ui-no-explanatory-text]].
