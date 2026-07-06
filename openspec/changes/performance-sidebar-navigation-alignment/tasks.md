## 1. Navigation Model

- [x] 1.1 Replace sidebar section labels and item labels with `Overview`, `Configuration > Objective Planning`, and `Platform administration > Performance configuration`.
- [x] 1.2 Preserve permission boundaries so Platform Admin does not receive tenant configuration navigation by role alone.
- [x] 1.3 Keep the shared `ModuleSidebar` flat section model; do not add nested menus or a configuration landing page in this change.

## 2. Routes and Breadcrumbs

- [x] 2.1 Move Tenant Objective Planning Configuration to `/performance/configuration/planning`.
- [x] 2.2 Move Platform Performance Configuration to `/performance/platform/configuration/performance`.
- [x] 2.3 Keep old `/performance/planning` and `/performance/defaults` as redirects or explicitly verify they are removed from all navigation.
- [x] 2.4 Update breadcrumbs to use the same navigation source as the sidebar.

## 3. Tests and Rendered Verification

- [x] 3.1 Add or update frontend tests for role-aware sidebar visibility and canonical nav labels.
- [x] 3.2 Run `Set-Location Frontend; pnpm --filter performance test`.
- [x] 3.3 Run `Set-Location Frontend; pnpm --filter performance type-check`.
- [x] 3.4 Run `Set-Location Frontend; pnpm --filter performance lint`.
- [x] 3.5 Verify rendered desktop and mobile Performance sidebar states in browser for tenant configuration, Platform Admin, and permission-limited users.
- [x] 3.6 Run `openspec validate performance-sidebar-navigation-alignment --strict`.
