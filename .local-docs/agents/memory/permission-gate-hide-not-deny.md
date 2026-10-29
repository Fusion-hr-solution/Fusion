---
name: permission-gate-hide-not-deny
description: "Fail closed by HIDING inaccessible functionality, not by showing it then denying"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9a9fff49-b877-4d0e-838d-141b4669d7c4
---

Don't surface nav items, doors, or actions a user can never complete and then explain "you can't." Hide them.

**Why:** showing a door that dead-ends (e.g. sidebar "Team objectives" → "Your account isn't linked to an employee record") is backwards UX and clutter. The user called this out directly on 2026-07-11.

**How to apply:** gate on *operational* access, not just the raw permission grant. Some Performance permissions (e.g. `performance.objective.team.manage`) are held by HR/Org admins at Tenant scope but are only usable by an employee-linked manager who is a frozen approver. Mirror the existing Core convention (`canAccessCoreTeam` / `canAccessOwnCoreProfile` fail closed on `!user?.employeeId`). Landed `canAccessTeamObjectives` (permission **and** `employeeId`) in `packages/auth/src/roles.ts`, used it for the sidebar nav gate and the team-objectives page gates, and dropped the now-dead "not linked to an employee record" empty state. Keep the raw `canManageTeamObjectives` for module-access checks (`canAccessPerformance`). Relates to [[ui-no-explanatory-text]] and atlas-demo-seed (archived).
