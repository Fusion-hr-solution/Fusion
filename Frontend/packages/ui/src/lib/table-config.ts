/**
 * Shared table configuration for consistent behavior across modules.
 * Import from @repo/ui to use in any module's data tables.
 */

/** Available page size options for data tables */
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

/** Default page size for data tables */
export const DEFAULT_PAGE_SIZE = 5;

/** Default page number (1-indexed) */
export const DEFAULT_PAGE = 1;

/** Type for page size values */
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

/** Default debounce delay for search inputs (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Pagination configuration interface */
export interface TablePaginationConfig {
  page: number;
  pageSize: PageSize;
  totalCount: number;
  totalPages: number;
}

/** Sort direction type */
export type SortDirection = "asc" | "desc";

/** Generic sort configuration */
export interface TableSortConfig<TSortField extends string = string> {
  sortBy?: TSortField;
  sortDir?: SortDirection;
}

/**
 * Parse pagination from URL search params with defaults
 */
export function parsePaginationFromParams(searchParams: URLSearchParams): {
  page: number;
  pageSize: PageSize;
} {
  const page = parseInt(searchParams.get("page") || String(DEFAULT_PAGE), 10);
  const pageSizeParam = parseInt(
    searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE),
    10
  );

  // Ensure pageSize is a valid option
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeParam as PageSize)
    ? (pageSizeParam as PageSize)
    : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

/**
 * Parse sort params from URL search params
 */
export function parseSortFromParams<TSortField extends string>(
  searchParams: URLSearchParams
): TableSortConfig<TSortField> {
  const sortBy = searchParams.get("sortBy") as TSortField | null;
  const sortDir = searchParams.get("sortDir") as SortDirection | null;

  return {
    sortBy: sortBy || undefined,
    sortDir: sortDir || undefined,
  };
}
