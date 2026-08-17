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
import { usePeople } from "../api/use-people";
import {
  EmployeeIdentity,
  EmploymentStatus,
  OrgPath,
  formatWorkforceDate,
} from "./workforce-ui";

const PAGE_SIZE = 25;
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

function EmploymentCell({ person }: { person: PeopleRowDto }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <EmploymentStatus state={person.employmentState} />
      <p className="type-meta text-muted-foreground">{employmentLabel(person)}</p>
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
  choices,
  selectedId,
  scope,
  onSelect,
  onScopeChange,
}: {
  choices: OrganizationChoice[];
  selectedId: string | null;
  scope: PeopleOrganizationScope;
  onSelect: (id: string | null) => void;
  onScopeChange: (scope: PeopleOrganizationScope) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = choices.find((choice) => choice.id === selectedId);
  const visible = query.trim()
    ? choices.filter((choice) => choice.path.toLowerCase().includes(query.trim().toLowerCase()))
    : choices;

  return (
    <Popover>
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
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search organizations"
              aria-label="Search organizations"
              className="pl-9"
            />
          </div>
          <RadioGroup
            value={scope}
            onValueChange={(value) => onScopeChange(value as PeopleOrganizationScope)}
            className="mt-3 grid grid-cols-2 gap-2"
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
        <div className="max-h-72 overflow-y-auto p-1" role="tree" aria-label="Organization hierarchy">
          <button
            type="button"
            role="treeitem"
            aria-selected={!selectedId}
            onClick={() => onSelect(null)}
            className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-muted"
          >
            All organizations
          </button>
          {visible.map((choice) => (
            <button
              type="button"
              role="treeitem"
              aria-selected={selectedId === choice.id}
              key={choice.id}
              onClick={() => onSelect(choice.id)}
              className="flex w-full min-w-0 items-center rounded-md py-2 pr-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-muted"
              style={{ paddingLeft: `${0.75 + choice.depth * 1.125}rem` }}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{choice.name}</span>
                {query ? <span className="block truncate text-xs text-muted-foreground">{choice.path}</span> : null}
              </span>
            </button>
          ))}
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching unit</p>
          ) : null}
        </div>
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
            <OrgPath name={person.work.organizationName} path={person.work.organizationPath} />
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
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 w-[26%] type-eyebrow text-muted-foreground">Employee</TableHead>
              <TableHead className="w-[28%] type-eyebrow text-muted-foreground">Work</TableHead>
              <TableHead className="w-[18%] type-eyebrow text-muted-foreground max-lg:hidden">Manager</TableHead>
              <TableHead className="w-[14%] type-eyebrow text-muted-foreground max-xl:hidden">Location</TableHead>
              <TableHead className="w-[16%] type-eyebrow text-muted-foreground">Employment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.employeeKey} className="h-[4.75rem]">
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
                    />
                  ) : (
                    <p className="mt-0.5 type-meta text-muted-foreground">No current organization</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 type-meta text-muted-foreground lg:hidden">
                    <span>{person.primaryManager?.displayName ?? "No manager"}</span>
                    {person.work?.location ? <span className="xl:hidden">{person.work.location}</span> : null}
                  </div>
                </TableCell>
                <TableCell className="max-lg:hidden">
                  <p className="type-body truncate">{person.primaryManager?.displayName ?? <span className="text-muted-foreground">No manager</span>}</p>
                  {person.primaryManager ? (
                    <p className="type-code text-xs text-muted-foreground">{person.primaryManager.employeeNumber}</p>
                  ) : null}
                </TableCell>
                <TableCell className="max-xl:hidden">
                  {person.work?.location ? (
                    <p className="type-body truncate">{person.work.location}</p>
                  ) : (
                    <span className="type-meta text-muted-foreground">—</span>
                  )}
                </TableCell>
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
  }), [direction, orgUnitId, page, q, scope, sort, state]);
  const people = usePeople(query);
  const organization = useOrganizationHierarchy(todayCalendarDate());
  const organizationChoices = useMemo(
    () => flattenOrganization(organization.data?.roots ?? []),
    [organization.data?.roots],
  );
  const hasFilters = Boolean(q || state || orgUnitId);
  const items = people.data?.items ?? [];
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
              choices={organizationChoices}
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
            <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 type-meta text-muted-foreground">
              <p className="tabular-nums">{people.data.totalCount.toLocaleString()} {people.data.totalCount === 1 ? "person" : "people"}</p>
              {people.data.totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => updateUrl({ page: String(page - 1) })}><ChevronLeft className="size-4" /> Previous</Button>
                  <span className="min-w-20 text-center tabular-nums">Page {page} of {people.data.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= people.data.totalPages} onClick={() => updateUrl({ page: String(page + 1) })}>Next <ChevronRight className="size-4" /></Button>
                </div>
              ) : null}
            </footer>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
