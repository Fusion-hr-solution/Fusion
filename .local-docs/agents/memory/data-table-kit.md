---
name: data-table-kit
description: "Shared data table kit `@repo/ds/data-table` on TanStack Table v9 — what it contains, deliberate exclusions, adoption follow-ups"
metadata:
  node_type: memory
  type: project
  originSessionId: 010a72d0-ed34-4e13-84d8-1500ff2f0303
  modified: 2026-09-30T16:38:25.865Z
---

`@repo/ds/data-table` (packages/ds/src/data-table/, added 2026-09-30) is Fusion's one data-table kit, built on TanStack Table **v9.2.4** (pinned in ds; core still has its own v8 wrapper).

- **`useDataTable`**: data, columns, `getRowId`, `search(row)`, `views` (quick-view predicates + counts, controllable), `initialSorting`, `pageSize`, `manual:{rowCount}` for server mode. Returns a `model`, which the components take as `model`.
- **Components:** `DataTable` is the whole object: toolbar (segmented views + `filters` slot + search + `actions` slot), sentence-case sortable header, 56px rows, footer range/pager, all states inside one frame, plus `onRowClick`/`canClickRow`. Filters: `DataTableFilters` is a Linear-style chip bar; it replaced `DataTableFacetFilter`. Field types are `options` (optionally `single`) and `dateRange`. It is controlled for server tables and bound to column filters in client mode (`arrIncludesSome` / `dateRange`). It is built on the DS DropdownMenu (checkbox/radio items, submenus) plus a DS Popover+Calendar for dates. The user flagged a custom Popover+Command version as reinventing DS dropdowns. While adding, the choice is held until the menu closes; editing a chip applies live. Search appears only for lists longer than 7. A date range takes two clicks, because react-day-picker reports the first click as a one-day range. Cell vocabulary: `DataTableCellStack`/`CellNumber`/`CellProgress`/`CellEmpty`/`RowChevron`.
- **Redesign 2026-09-30:** the user rejected the first pass (floating toolbar, pills, uppercase headers, uneven rows, mixed action styles) and asked for ground-up consistency. The grammar is now in DESIGN.md "Data tables".
- **v9 gotchas:** the column option is `sortFn`, not `sortingFn`. String sort names only resolve if they're registered in `dataTableFeatures.sortFns`. Meta is typed through `columnMeta: metaHelper<DataTableColumnMeta>()`.
- **Deliberately excluded:** row selection, a column-visibility menu, range and date filters, virtualization, pinning, resizing. Add them to the bundle when a real table needs them.
- **Consumers:**
  - perf `team/your-people.tsx` (client mode).
  - platform `tenants/overview/tenants-workspace.tsx` (server mode, 2026-09-30). Search, sort, page and page size are in the URL; `size` is a new URL param and `TENANT_PAGE_SIZES`. The local `tenant-pagination.tsx`, `tenant-filter-panel.tsx` and the mobile card list were removed. Tenant filters are Activation (the cards' state), Module (all six Fusion modules; ids the server doesn't grant are resolved client-side in `api.ts` because the server 400s on them) and Created. The Invitation and Delivery filters were retired at the user's request to simplify.
- **Server mode:** `manual:{rowCount,isFiltered,onReset}` plus controlled `searchQuery`, `sorting`, `pagination` with their `on*Change` callbacks, and `viewCounts`.
- **DataTable props added by tenants:** `error`, `isRefreshing`, `notice`, and `meta.hideBelow` for responsive columns. Row clicks ignore portal-bubbled clicks. The pager collapses to `1 / N` below sm.

**Why:** five hand-rolled tables (your-people, people-in-scope, core DataTable, platform tenants, core people-workspace) each had their own sort, chips and pager.
**How to apply:** new or reworked tables use the kit. Follow-ups, not yet done: people-in-scope (needs facet filter + row selection), core employees on `manual` mode then drop v8, core people-workspace, retire `TableFilterToolbar`. Doctrine is in DESIGN.md "Data tables". Related: [[surface-tone-ladder]], [[layout-document-sidebar]].

**Unified filters (2026-09-30):** the user chose one model and one presentation. `useDataTable({ filters, filterState, onFilterStateChange, filterCounts })` owns every narrowing dimension. Options match either a per-option `match(row)` predicate or the field's `value(row)`. `pinned: true` replaces the old segmented `views` (always shown, resets to "All"). `DataTable` renders the chips itself, so there is no `filters` slot. Removed: `views`/`view`/`viewCounts`, `DataTableViews`, `manual.isFiltered`/`onReset`, and the `dateRange` column filterFn. Tenants' `update()` builds on a `pending` ref so back-to-back changes (reset) don't race the async URL.
