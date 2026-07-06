## Why

Performance navigation is currently shaped by implementation partitions and individual P1.1 pages. This creates long labels, weak workspace hierarchy, and no stable place for future Performance configuration sections.

## What Changes

- Reframe Performance sidebar navigation around role-aware workspaces instead of feature/page names.
- Replace `Reviews`, `Performance setup`, and `Platform setup` sidebar group language with `Overview`, `Configuration`, and `Platform administration`.
- Move the Tenant Objective Planning Configuration route to `/performance/configuration/planning` and label the sidebar item `Objective Planning`.
- Move Platform Performance Configuration to `/performance/platform/configuration/performance` and label the sidebar item `Performance configuration`.
- Preserve the full product page titles: `Objective planning configuration` and `Platform performance configuration`.
- Preserve separate Platform Admin and tenant configuration authority: Platform Admin does not automatically receive tenant configuration navigation.

## Capabilities

### New Capabilities

- `performance-navigation`: Performance sidebar and route information architecture for role-aware workspaces and configuration destinations.

## Impact

- Frontend Performance: sidebar constants, breadcrumbs, route folders, route compatibility redirects, and rendered shell verification.
- Shared design system: no change expected; existing `ModuleSidebar` section support is sufficient for this MVP.
- Auth: no permission model change; existing tenant-scoped objective-planning configuration checks and Platform Admin checks remain authoritative.
- APIs, backend, persistence: no change expected.
