"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@repo/ds";
import { PageContainer, PageHeader } from "@repo/ds/shell";
import {
  canImportCoreEmployees,
  canManageCoreEmployees,
  useAuth,
} from "@repo/auth";
import type {
  OrganizationHierarchyNodeDto,
  PeopleEmploymentState,
  PeopleOrganizationScope,
  PeopleQueryParams,
  PeopleRowDto,
  PeopleSortDirection,
  PeopleSortField,
} from "@repo/api";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  Upload,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useOrganizationHierarchy } from "@/features/organization/api/use-organization";
import { OrganizationTree } from "@/features/organization/components/organization-tree";
import { usePeople } from "../api/use-people";
import {
  EmployeeIdentity,
  EmploymentStatus,
  OrgPath,
  formatWorkforceDate,
} from "./workforce-ui";

const PAGE_SIZE = 10;
const EMPLOYMENT_STATES: PeopleEmploymentState[] = ["Active", "Scheduled", "Former", "Incomplete"];

function todayCalendarDate() {
  return new Date().toISOString().slice(0, 10);
}

function employmentLabel(person: PeopleRowDto) {
  if (person.employmentState === "Scheduled") return `Starts ${formatWorkforceDate(person.employmentStart)}`;
  if (person.employmentState === "Former") return person.employmentEnd ? `Ended ${formatWorkforceDate(person.employmentEnd)}` : "Former employee";
  if (person.employmentState === "Incomplete") return "Employment unavailable";
  return `Since ${formatWorkforceDate(person.employmentStart)}`;
}

const STATE_DOT: Record<PeopleEmploymentState, string> = {
  Active: "bg-success",
  Scheduled: "bg-info",
  Former: "bg-muted-foreground/50",
  Incomplete: "bg-warning",
};

/**
 * Roster employment state — a quiet dot + label + date rather than a filled pill on
 * every single row. Reserving the pill treatment for the profile keeps the directory
 * calm (§33.8) while still non-color-only.
 */
function EmploymentCell({ person }: { person: PeopleRowDto }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 type-body">
        <span aria-hidden className={cn("size-1.5 rounded-full", STATE_DOT[person.employmentState])} />
        {person.employmentState}
      </p>
      <p className="mt-1 pl-3.5 type-meta text-muted-foreground">{employmentLabel(person)}</p>
    </div>
  );
}

type OrganizationChoice = {
  id: string;
  name: string;
  path: string;
  depth: number;
};

function flattenOrganization(
  nodes: OrganizationHierarchyNodeDto[],
  depth = 0,
): OrganizationChoice[] {
  return nodes.flatMap((node) => [
    { id: node.unit.id, name: node.unit.name, path: node.unit.path, depth },
    ...flattenOrganization(node.children, depth + 1),
  ]);
}

function OrganizationFilter({
  roots,
  selectedId,
  scope,
  onSelect,
  onScopeChange,
}: {
  roots: OrganizationHierarchyNodeDto[];
  selectedId: string | null;
  scope: PeopleOrganizationScope;
  onSelect: (id: string | null) => void;
  onScopeChange: (scope: PeopleOrganizationScope) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => flattenOrganization(roots).find((choice) => choice.id === selectedId), [roots, selectedId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("max-w-64 justify-between gap-2 font-normal", selected && "border-foreground/25")}
        >
          <Building2 className="size-4 text-muted-foreground" />
          <span className="truncate">{selected?.name ?? "All organizations"}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
        {selectedId ? (
          <div className="border-b border-border p-3">
            <RadioGroup
              value={scope}
              onValueChange={(value) => onScopeChange(value as PeopleOrganizationScope)}
              className="grid grid-cols-2 gap-2"
              aria-label="Organization scope"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-data-[state=checked]:border-foreground/30 has-data-[state=checked]:bg-muted/50">
                <RadioGroupItem value="Subtree" /> Unit and teams below
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-data-[state=checked]:border-foreground/30 has-data-[state=checked]:bg-muted/50">
                <RadioGroupItem value="Direct" /> This unit only
              </label>
            </RadioGroup>
          </div>
        ) : null}
        <OrganizationTree
          roots={roots}
          selectedId={selectedId}
          onSelect={(id) => {
            onSelect(id);
            if (id === null) setOpen(false);
          }}
          allOption={{ label: "All organizations" }}
          emptyLabel="No matching unit"
        />
      </PopoverContent>
    </Popover>
  );
}

function PeopleSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border" aria-label="Loading people">
      <div className="flex items-center gap-6 border-b bg-muted/30 px-4 py-3">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-3 w-24" />)}
      </div>
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0">
          <Skeleton className="size-9 rounded-[0.625rem]" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
          <div className="hidden flex-1 space-y-2 sm:block"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-44" /></div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function PersonMobileRow({ person }: { person: PeopleRowDto }) {
  return (
    <article className="border-b py-4 last:border-b-0 sm:hidden">
      <div className="flex items-start justify-between gap-3">
        <EmployeeIdentity
          name={person.displayName}
          employeeNumber={person.employeeNumber}
          href={`/people/${person.employeeKey}`}
        />
        <EmploymentStatus state={person.employmentState} />
      </div>
      <div className="mt-3 space-y-2 pl-12">
        <div>
          <p className="type-body">{person.work?.jobTitle ?? "Work details unavailable"}</p>
          {person.work ? (
            <OrgPath name={person.work.organizationName} path={person.work.organizationPath} showAncestry={false} />
          ) : (
            <p className="type-meta text-muted-foreground">No current organization</p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 type-meta text-muted-foreground">
          <span>{person.primaryManager?.displayName ?? "No manager"}</span>
          {person.work?.location ? <span>{person.work.location}</span> : null}
          <span>{employmentLabel(person)}</span>
        </div>
      </div>
    </article>
  );
}

function PeopleTable({ people }: { people: PeopleRowDto[] }) {
  // Location is optional workforce data; a whole column of dashes is dead weight, so
  // the column only exists when at least one person on the page actually has a location.
  const showLocation = people.some((person) => Boolean(person.work?.location));
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 w-[28%] type-eyebrow text-muted-foreground">Employee</TableHead>
              <TableHead className={cn("type-eyebrow text-muted-foreground", showLocation ? "w-[28%]" : "w-[34%]")}>Work</TableHead>
              <TableHead className="w-[20%] type-eyebrow text-muted-foreground max-lg:hidden">Manager</TableHead>
              {showLocation ? <TableHead className="w-[14%] type-eyebrow text-muted-foreground max-xl:hidden">Location</TableHead> : null}
              <TableHead className="w-[16%] type-eyebrow text-muted-foreground">Employment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.employeeKey} className="h-[4.5rem]">
                <TableCell>
                  <EmployeeIdentity
                    name={person.displayName}
                    employeeNumber={person.employeeNumber}
                    href={`/people/${person.employeeKey}`}
                  />
                </TableCell>
                <TableCell>
                  <p className="type-body truncate">{person.work?.jobTitle ?? "Work details unavailable"}</p>
                  {person.work ? (
                    <OrgPath
                      name={person.work.organizationName}
                      path={person.work.organizationPath}
                      className="mt-0.5"
                      showAncestry={false}
                    />
                  ) : (
                    <p className="mt-0.5 type-meta text-muted-foreground">No current organization</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 type-meta text-muted-foreground lg:hidden">
                    <span>{person.primaryManager?.displayName ?? "No manager"}</span>
                    {showLocation && person.work?.location ? <span className="xl:hidden">{person.work.location}</span> : null}
                  </div>
                </TableCell>
                <TableCell className="max-lg:hidden">
                  {person.primaryManager ? (
                    <p className="type-body truncate">{person.primaryManager.displayName}</p>
                  ) : (
                    <span className="type-meta text-muted-foreground">No manager</span>
                  )}
                </TableCell>
                {showLocation ? (
                  <TableCell className="max-xl:hidden">
                    {person.work?.location ? (
                      <p className="type-body truncate">{person.work.location}</p>
                    ) : (
                      <span className="type-meta text-muted-foreground">—</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell><EmploymentCell person={person} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="sm:hidden">{people.map((person) => <PersonMobileRow key={person.employeeKey} person={person} />)}</div>
    </>
  );
}

function EstablishAction({
  href,
  icon: Icon,
  label,
  tone,
  disabled,
}: {
  href: string;
  icon: typeof Upload;
  label: string;
  tone: "primary" | "default" | "quiet";
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-2xl border p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        tone === "primary"
          ? "border-primary/40 bg-primary/[0.06] hover:bg-primary/10"
          : tone === "default"
            ? "hover:bg-muted/50"
            : "border-transparent hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-[0.625rem]",
          tone === "primary" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="type-label font-semibold">{label}</span>
      <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

function EstablishWorkforce({ canManage, canImport }: { canManage: boolean; canImport: boolean }) {
  return (
    <section aria-label="Establish your workforce" className="mx-auto grid max-w-lg gap-2.5 py-16 sm:py-24">
      <p className="type-eyebrow text-muted-foreground">Establish your workforce</p>
      <h2 className="type-page-title mb-4 text-balance">Bring your people into Fusion</h2>
      <EstablishAction href="/people/import" icon={Upload} label="Import workforce" tone="primary" disabled={!canImport} />
      <EstablishAction href="/people/add-existing" icon={UserRoundPlus} label="Add existing employee" tone="default" disabled={!canManage} />
      <EstablishAction href="/people/hire" icon={Plus} label="Hire employee" tone="quiet" disabled={!canManage} />
    </section>
  );
}

export default function PeopleWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canManage = canManageCoreEmployees(user);
  const canImport = canImportCoreEmployees(user);
  const q = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(q);
  const stateParam = searchParams.get("status");
  const state = EMPLOYMENT_STATES.includes(stateParam as PeopleEmploymentState) ? stateParam as PeopleEmploymentState : null;
  const orgUnitId = searchParams.get("orgUnitId");
  const scope = searchParams.get("scope") === "Direct" ? "Direct" : "Subtree";
  const sort = (["Name", "EmployeeNumber", "EmploymentDate"] as const).includes(searchParams.get("sort") as PeopleSortField)
    ? searchParams.get("sort") as PeopleSortField
    : "Name";
  const direction = searchParams.get("direction") === "Desc" ? "Desc" : "Asc";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const importBatch = searchParams.get("importBatch");

  const updateUrl = useCallback((updates: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    const href = `${pathname}${next.size ? `?${next.toString()}` : ""}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    if (search === q) return;
    const timer = window.setTimeout(() => updateUrl({ q: search.trim() || null, page: null }, true), 250);
    return () => window.clearTimeout(timer);
  }, [q, search, updateUrl]);

  const query = useMemo<PeopleQueryParams>(() => ({
    q: q || null,
    state,
    orgUnitId,
    organizationScope: scope,
    sort,
    direction,
    page,
    pageSize: PAGE_SIZE,
    importBatch: importBatch || null,
  }), [direction, orgUnitId, page, q, scope, sort, state, importBatch]);
  const people = usePeople(query);
  const organization = useOrganizationHierarchy(todayCalendarDate());
  const hasFilters = Boolean(q || state || orgUnitId || importBatch);
  const items = people.data?.items ?? [];
  const cohortCount = importBatch ? people.data?.totalCount ?? items.length : 0;
  const isTrueEmpty = Boolean(people.data) && !people.error && !hasFilters && items.length === 0;

  const clearFilters = useCallback(() => {
    setSearch("");
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  const headerActions = canManage && !isTrueEmpty ? (
    <div className="flex items-center gap-2">
      {canImport ? (
        <Button variant="outline" asChild>
          <Link href="/people/import"><Upload className="size-4" /> Import</Link>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button><Plus className="size-4" /> Add employee <ChevronDown className="size-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem asChild><Link href="/people/hire">Hire employee</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/people/add-existing">Add existing employee</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  return (
    <PageContainer width="wide" className="pb-12">
      <PageHeader title="People" actions={headerActions} />

      {importBatch ? (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <p className="type-title font-semibold text-foreground">
            <span className="tabular-nums">{cohortCount}</span>{" "}
            {cohortCount === 1 ? "employee added" : "employees added"}
          </p>
          <button
            type="button"
            onClick={() => updateUrl({ importBatch: null, page: null }, true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 type-meta font-medium text-foreground ring-1 ring-inset ring-primary/25 transition-colors hover:bg-primary/15"
          >
            Added in this import
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {isTrueEmpty ? (
        <EstablishWorkforce canManage={canManage} canImport={canImport} />
      ) : (
        <>
          <section aria-label="Filter people" className="mb-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[15rem] flex-1 md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search People" className="pl-9 pr-9" />
              {search ? (
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <NativeSelect value={state ?? ""} onChange={(event) => updateUrl({ status: event.target.value || null, page: null })} aria-label="Employment state" className="w-36">
              <NativeSelectOption value="">All states</NativeSelectOption>
              {EMPLOYMENT_STATES.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}
            </NativeSelect>
            <OrganizationFilter
              roots={organization.data?.roots ?? []}
              selectedId={orgUnitId}
              scope={scope}
              onSelect={(id) => updateUrl({ orgUnitId: id, page: null })}
              onScopeChange={(value) => updateUrl({ scope: value === "Subtree" ? null : value, page: null })}
            />
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <RotateCcw className="size-4" /> Clear filters
              </Button>
            ) : null}
            <div className="ml-auto flex items-center gap-2 text-muted-foreground">
              <label htmlFor="people-sort" className="type-meta max-sm:sr-only">Sort</label>
              <NativeSelect id="people-sort" value={`${sort}:${direction}`} onChange={(event) => {
                const [nextSort, nextDirection] = event.target.value.split(":") as [PeopleSortField, PeopleSortDirection];
                updateUrl({ sort: nextSort === "Name" ? null : nextSort, direction: nextDirection === "Asc" ? null : nextDirection, page: null });
              }} aria-label="Sort People" className="w-40 border-transparent bg-muted/40 text-foreground">
                <NativeSelectOption value="Name:Asc">Name A–Z</NativeSelectOption>
                <NativeSelectOption value="Name:Desc">Name Z–A</NativeSelectOption>
                <NativeSelectOption value="EmployeeNumber:Asc">Employee Number</NativeSelectOption>
                <NativeSelectOption value="EmploymentDate:Desc">Newest start</NativeSelectOption>
              </NativeSelect>
            </div>
          </section>

          {people.isLoading && !people.data ? <PeopleSkeleton /> : people.error ? (
            <Empty className="min-h-72 rounded-2xl border">
              <EmptyMedia variant="icon"><RotateCcw /></EmptyMedia>
              <EmptyHeader><EmptyTitle>People could not be loaded</EmptyTitle></EmptyHeader>
              <EmptyContent><Button variant="outline" onClick={() => void people.refetch()}>Retry</Button></EmptyContent>
            </Empty>
          ) : items.length === 0 ? (
            <Empty className="min-h-72 rounded-2xl border">
              <EmptyMedia variant="icon"><Search /></EmptyMedia>
              <EmptyHeader><EmptyTitle>No matching people</EmptyTitle></EmptyHeader>
              <EmptyContent><Button variant="outline" onClick={clearFilters}>Clear filters</Button></EmptyContent>
            </Empty>
          ) : (
            <PeopleTable people={items} />
          )}

          {people.data && people.data.totalCount > 0 ? (
            <PeoplePagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={people.data.totalCount}
              onPageChange={(next) => updateUrl({ page: next <= 1 ? null : String(next) })}
            />
          ) : null}
        </>
      )}
    </PageContainer>
  );
}

/**
 * Roster pagination — the same grammar as the Platform tenant directory: a bordered
 * footer bar whose range ("Showing X–Y of N") is always present because it answers
 * "how many are there?", with numbered page controls added once there is more than one
 * page. The number run keeps a stable width via a first/last + windowed-neighbours set.
 */
function PeoplePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (next: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  // A dataset that fits on one page gets no pager chrome — just a quiet count.
  if (pageCount <= 1) {
    return (
      <p className="mt-4 type-meta text-muted-foreground">
        <span className="tabular-nums text-foreground">{totalCount.toLocaleString()}</span> {totalCount === 1 ? "person" : "people"}
      </p>
    );
  }

  return (
    <nav
      aria-label="People pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
    >
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Showing <span className="tabular-nums text-foreground">{from.toLocaleString()}</span>–
        <span className="tabular-nums text-foreground">{to.toLocaleString()}</span> of{" "}
        <span className="tabular-nums text-foreground">{totalCount.toLocaleString()}</span>{" "}
        {totalCount === 1 ? "person" : "people"}
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </Button>

          <ol className="flex items-center gap-1">
            {pageNumbers(page, pageCount).map((entry, index) =>
              entry === "gap" ? (
                <li key={`gap-${index}`} aria-hidden className="px-1 text-sm text-muted-foreground">…</li>
              ) : (
                <li key={entry}>
                  <Button
                    variant={entry === page ? "default" : "ghost"}
                    size="sm"
                    aria-label={`Page ${entry}`}
                    aria-current={entry === page ? "page" : undefined}
                    onClick={() => onPageChange(entry)}
                    className="min-w-9 tabular-nums"
                  >
                    {entry}
                  </Button>
                </li>
              )
            )}
          </ol>

          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            Next
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      ) : null}
    </nav>
  );
}

/** First page, last page, and a stable-width window around the current one. */
function pageNumbers(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const window = new Set([1, pageCount, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((entry) => window.add(entry));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((entry) => window.add(entry));

  const pages = [...window].filter((entry) => entry >= 1 && entry <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  let previous = 0;
  for (const entry of pages) {
    if (previous && entry - previous > 1) result.push("gap");
    result.push(entry);
    previous = entry;
  }
  return result;
}
