import type {
  DeliveryOutcomeValue,
  InvitationStateValue,
  OverviewFilter,
  TenantModule,
  TenantOverviewQuery,
  TenantOverviewSort,
} from "../api";

/**
 * The workspace query lives in the URL.
 *
 * Opening a tenant and coming back, sharing a link, or reloading after an
 * interruption must all land on the same list the operator was reading. That
 * only holds if the URL — not component state — is the source of truth, so this
 * module owns both directions of the translation and nothing else parses the
 * query string.
 */

export const DEFAULT_QUERY: TenantOverviewQuery = {
  filter: "All",
  search: "",
  invitationStates: [],
  deliveryOutcomes: [],
  modules: [],
  createdFrom: null,
  createdTo: null,
  sort: "CreatedDescending",
  page: 1,
};

const FILTERS: OverviewFilter[] = [
  "All",
  "AwaitingActivation",
  "Active",
  "NeedsAttention",
];

const INVITATION_STATES: InvitationStateValue[] = [
  "Pending",
  "Accepted",
  "Expired",
  "Revoked",
  "Superseded",
];

const DELIVERY_OUTCOMES: DeliveryOutcomeValue[] = ["Sent", "Failed"];

const SORTS: TenantOverviewSort[] = [
  "CreatedDescending",
  "CreatedAscending",
  "NameAscending",
  "NameDescending",
];

/** Yyyy-mm-dd, which is what a date input produces and the service accepts. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function pickAll<T extends string>(
  raw: string[],
  allowed: readonly T[]
): T[] {
  // A hand-edited or stale URL must narrow the list to something real rather
  // than passing an unknown value to the service.
  return allowed.filter((value) => raw.includes(value));
}

export function parseQuery(
  params: URLSearchParams,
  moduleCatalogue: readonly TenantModule[]
): TenantOverviewQuery {
  const page = Number.parseInt(params.get("page") ?? "", 10);

  return {
    filter: FILTERS.find((value) => value === params.get("filter")) ?? "All",
    search: params.get("q") ?? "",
    invitationStates: pickAll(params.getAll("invitation"), INVITATION_STATES),
    deliveryOutcomes: pickAll(params.getAll("delivery"), DELIVERY_OUTCOMES),
    modules: pickAll(params.getAll("module"), moduleCatalogue),
    createdFrom: readDate(params.get("from")),
    createdTo: readDate(params.get("to")),
    sort: SORTS.find((value) => value === params.get("sort")) ?? "CreatedDescending",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function readDate(value: string | null): string | null {
  return value && DATE.test(value) ? value : null;
}

/**
 * Only what differs from the default is written, so an untouched workspace has
 * a clean URL and a shared link carries exactly the choices that were made.
 */
export function serializeQuery(query: TenantOverviewQuery): string {
  const params = new URLSearchParams();

  if (query.filter !== "All") params.set("filter", query.filter);
  if (query.search.trim()) params.set("q", query.search.trim());
  for (const state of query.invitationStates) params.append("invitation", state);
  for (const outcome of query.deliveryOutcomes) params.append("delivery", outcome);
  for (const moduleId of query.modules) params.append("module", moduleId);
  if (query.createdFrom) params.set("from", query.createdFrom);
  if (query.createdTo) params.set("to", query.createdTo);
  if (query.sort !== "CreatedDescending") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));

  return params.toString();
}

/** The advanced filters only, which is what the Filter control reports on. */
export type AdvancedFilters = Pick<
  TenantOverviewQuery,
  "invitationStates" | "deliveryOutcomes" | "modules" | "createdFrom" | "createdTo"
>;

export const NO_ADVANCED_FILTERS: AdvancedFilters = {
  invitationStates: [],
  deliveryOutcomes: [],
  modules: [],
  createdFrom: null,
  createdTo: null,
};

/**
 * How many conditions are narrowing the list. A date range counts once because
 * the operator set one range, not two independent filters.
 */
export function activeFilterCount(filters: AdvancedFilters): number {
  return (
    filters.invitationStates.length +
    filters.deliveryOutcomes.length +
    filters.modules.length +
    (filters.createdFrom || filters.createdTo ? 1 : 0)
  );
}

export function isQueryNarrowed(query: TenantOverviewQuery): boolean {
  return (
    query.filter !== "All" ||
    query.search.trim().length > 0 ||
    activeFilterCount(query) > 0
  );
}

/**
 * Narrowing the result set must not strand the reader on a page that no longer
 * exists, so anything that changes which tenants match returns to page 1.
 */
export function withQueryChange(
  query: TenantOverviewQuery,
  change: Partial<TenantOverviewQuery>
): TenantOverviewQuery {
  const next = { ...query, ...change };
  return "page" in change ? next : { ...next, page: 1 };
}
