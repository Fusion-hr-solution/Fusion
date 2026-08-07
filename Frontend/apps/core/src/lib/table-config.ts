/**
 * Table configuration for Core data tables — pagination and search-debounce policy.
 * Non-visual constants owned by the app; not a design-system concern.
 */

/** Available page size options for data tables */
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

/** Default page size for data tables */
export const DEFAULT_PAGE_SIZE = 5;

/** Default debounce delay for search inputs (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Type for page size values */
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
