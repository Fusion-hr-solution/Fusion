import type { ReactNode } from "react";
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludesSome,
  filterFn_equalsString,
  filterFn_includesString,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import type { ReactTable } from "@tanstack/react-table";

/** Presentation hints every Fusion data-table column may carry. */
export interface DataTableColumnMeta {
  /** Human label for the column: the sort button's accessible name and a facet filter's title. */
  label?: string;
  align?: "start" | "center" | "end";
  /** CSS width for the column (`"26%"`, `"8rem"`), applied through a `<colgroup>`. */
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
  /** What the column shows while the table is loading; a text bar by default. */
  skeleton?: ReactNode;
  /** Drop the column below this breakpoint, keeping the table readable on narrow screens. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

/**
 * The one feature bundle Fusion tables run on. TanStack v9 only ships what is registered here, and a
 * string `sortFn` (including the default `"auto"`) only resolves against the registered `sortFns` —
 * a missing entry silently leaves a column unsorted.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnFacetingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
  filterFns: {
    includesString: filterFn_includesString,
    arrIncludesSome: filterFn_arrIncludesSome,
    equalsString: filterFn_equalsString,
  },
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
export type DataTableColumnDef<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a column list mixes value types, as TanStack's own helpers do
  any
>;
export type DataTableInstance<TData extends RowData> = ReactTable<
  DataTableFeatures,
  TData
>;

/** Column helper bound to the Fusion bundle, so column definitions see its sort and filter names. */
export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}
