"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { toast } from "sonner";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@repo/ds";
import { PageHeader, PagePermissionNotice } from "@repo/ds/shell";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeftRight,
  Ban,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileOutput,
  History,
  ListTree,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import {
  canManageCoreOrganization,
  canViewCoreOrganization,
  canViewTenantAdministration,
  useAuth,
} from "@repo/auth";
import type {
  OrganizationChangeDto,
  OrganizationUnitStateDto,
} from "@repo/api";
import { useTenantAccessSummary } from "@/features/tenant-access/api/use-tenant-access";
import {
  useOrganizationHierarchy,
  useOrganizationHistory,
  useOrganizationMutations,
  useOrganizationReadiness,
  useOrganizationSearch,
  useOrganizationTypes,
  useOrganizationUnit,
  useOrganizationUpcomingChanges,
} from "../api/use-organization";
import {
  buildOrganizationHierarchy,
  type OrganizationHierarchyModel,
} from "../model/hierarchy";
import {
  readOrganizationUrlState,
  organizationLocalReducer,
  todayCalendarDate,
  writeOrganizationUrlState,
  type OrganizationLocalState,
  type OrganizationUrlState,
} from "../model/workspace-state";
import { useOrganizationImportApi } from "@/features/organization-import/api/use-organization-import";
import { downloadBlob } from "@/features/organization-import/model/format";
import { OrganizationOutline } from "./organization-outline";
import {
  CorrectionPanel,
  CreateTypeDialog,
  InactivateDialog,
  ManageTypesPanel,
  MoveReviewDialog,
  RootEstablishment,
  UnitFormPanel,
  UpcomingChangesSheet,
} from "./organization-surfaces";

const OrganizationChart = dynamic(() => import("./organization-chart"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[520px] place-items-center bg-muted/15">
      <div className="space-y-4 text-center">
        <Skeleton className="mx-auto h-24 w-56 rounded-xl" />
        <div className="flex gap-12">
          <Skeleton className="h-24 w-56 rounded-xl" />
          <Skeleton className="h-24 w-56 rounded-xl" />
        </div>
        <p className="text-xs text-muted-foreground">
          Laying out the hierarchy…
        </p>
      </div>
    </div>
  ),
});

function eventLabel(change: OrganizationChangeDto) {
  const labels = change.businessEventKinds.map((kind) =>
    String(kind).replace("TypeChanged", "Type changed")
  );
  return labels.join(" + ") || String(change.kind);
}

function eventContext(change: OrganizationChangeDto) {
  if (change.businessEventKinds.includes("Moved"))
    return `${change.before?.parent?.name ?? "No parent"} → ${change.after?.parent?.name ?? "No parent"}`;
  if (change.businessEventKinds.includes("Renamed"))
    return `${change.before?.name ?? "—"} → ${change.after?.name ?? "—"}`;
  if (change.businessEventKinds.includes("TypeChanged"))
    return `${change.before?.type.name ?? "—"} → ${change.after?.type.name ?? "—"}`;
  if (change.businessEventKinds.includes("Inactivated"))
    return "Active → Inactive";
  return change.summary ?? "Organization established";
}

function StructureSkeleton() {
  return (
    <div className="grid min-h-[560px] place-items-center bg-muted/10">
      <div className="space-y-12">
        <Skeleton className="mx-auto h-24 w-56 rounded-xl" />
        <div className="flex gap-16">
          <Skeleton className="h-24 w-56 rounded-xl" />
          <Skeleton className="h-24 w-56 rounded-xl" />
          <Skeleton className="h-24 w-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function InspectorContent({
  selectedId,
  asOf,
  today,
  canManage,
  readOnly,
  model,
  onClose,
  onEdit,
  onAddChild,
  onMove,
  onInactivate,
  onCorrect,
}: {
  selectedId: string;
  asOf: string;
  today: string;
  canManage: boolean;
  readOnly: boolean;
  model: OrganizationHierarchyModel;
  onClose: () => void;
  onEdit: (unit: OrganizationUnitStateDto) => void;
  onAddChild: (id: string) => void;
  onMove: (id: string) => void;
  onInactivate: (unit: OrganizationUnitStateDto) => void;
  onCorrect: (unit: OrganizationUnitStateDto, date: string) => void;
}) {
  const [tab, setTab] = useState("details");
  const detail = useOrganizationUnit(selectedId, asOf);
  const history = useOrganizationHistory(selectedId, Boolean(selectedId));
  const unit = detail.data;
  const root = unit?.parentId === null;
  const businessEvents = (history.data ?? []).filter(
    (event) => event.businessEventKinds.length > 0
  );
  const recentEvents = businessEvents.slice(0, 3);

  return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {unit?.name ??
                model.byId.get(selectedId)?.name ??
                "Organizational unit"}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {unit ? `${unit.typeName} · ${unit.code}` : "Loading details…"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close inspector"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent
            value="details"
            className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3"
          >
            {detail.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-3/4" />
              </div>
            ) : detail.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Details unavailable</AlertTitle>
                <AlertDescription>
                  {detail.error.message}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => void detail.refetch()}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : unit ? (
              <>
                <dl className="divide-y text-sm">
                  <div className="grid grid-cols-[100px_1fr] gap-3 py-3">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">{unit.name}</dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-3 py-3">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>{unit.typeName}</dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-3 py-3">
                    <dt className="text-muted-foreground">Code</dt>
                    <dd className="font-mono text-xs">{unit.code}</dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-3 py-3">
                    <dt className="text-muted-foreground">Parent</dt>
                    <dd>{unit.parentName ?? "Organization root"}</dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-3 py-3">
                    <dt className="text-muted-foreground">Path</dt>
                    <dd className="leading-5 text-muted-foreground">
                      {unit.path}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-3 py-3">
                    <dt className="text-muted-foreground">Effective</dt>
                    <dd>{unit.effectiveFrom}</dd>
                  </div>
                </dl>
                {canManage && !readOnly ? (
                  <div className="mt-5 flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 px-2 text-xs"
                      onClick={() => onEdit(unit)}
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 px-2 text-xs"
                      onClick={() => onAddChild(unit.id)}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      Add child
                    </Button>
                    {!root ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 px-2 text-xs"
                        onClick={() => onMove(unit.id)}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                        Move
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 px-2 text-xs"
                          aria-label="More actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
                          More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onSelect={() => onCorrect(unit, asOf)}>
                          <Wrench className="h-4 w-4" />
                          Correct recorded data
                        </DropdownMenuItem>
                        {!root ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => onInactivate(unit)}
                          >
                            <Ban className="h-4 w-4" />
                            Inactivate unit
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : null}
                <div className="mt-6 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Recent history
                    </p>
                    {businessEvents.length ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => setTab("history")}
                      >
                        View full history
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                  {history.isLoading ? (
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-2/3" />
                    </div>
                  ) : recentEvents.length ? (
                    <ul className="mt-3 space-y-2.5">
                      {recentEvents.map((event) => {
                        const scheduled = event.effectiveDate > today;
                        return (
                          <li
                            key={event.id}
                            className="flex items-start gap-2.5 text-xs"
                          >
                            <span
                              className={cn(
                                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                                scheduled ? "bg-warning" : "bg-primary"
                              )}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {eventLabel(event)}
                              </p>
                              <p className="truncate text-muted-foreground">
                                {event.effectiveDate} · {eventContext(event)}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No effective changes yet.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </TabsContent>
          <TabsContent
            value="history"
            className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3"
          >
            {history.isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : history.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>History unavailable</AlertTitle>
                <AlertDescription>
                  {history.error.message}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => void history.refetch()}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : businessEvents.length ? (
              <ol className="relative space-y-0 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-border">
                {businessEvents.map((event) => {
                  const scheduled = event.effectiveDate > today;
                  return (
                    <li key={event.id} className="group/history relative pb-5 pl-6">
                      <span
                        className={cn(
                          "absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                          scheduled ? "bg-warning" : "bg-primary"
                        )}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {eventLabel(event)}
                            </p>
                            {scheduled ? (
                              <Badge variant="outline" className="text-[10px]">
                                Scheduled
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.effectiveDate}
                          </p>
                          <p className="mt-1 text-xs leading-5">
                            {eventContext(event)}
                          </p>
                        </div>
                        {canManage && !readOnly && unit ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="-mr-1 h-7 w-7 shrink-0 text-muted-foreground opacity-0 group-hover/history:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                                aria-label={`Actions for ${eventLabel(event)} effective ${event.effectiveDate}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  onCorrect(unit, event.effectiveDate)
                                }
                              >
                                Correct this state…
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="py-12 text-center">
                <History className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  No business history yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Effective changes will appear here.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
  );
}

export default function OrganizationWorkspace() {
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewCoreOrganization(user);
  const canManage = canManageCoreOrganization(user);
  const canReadTenantName = canViewTenantAdministration(user);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = todayCalendarDate();
  const urlState = readOrganizationUrlState(
    new URLSearchParams(searchParams.toString()),
    today
  );
  const readOnly = urlState.asOf !== today;
  const [local, dispatchLocal] = useReducer(organizationLocalReducer, {
    collapsed: new Set<string>(),
    unitForm: null,
    manageTypes: false,
    createType: false,
    createdTypeId: null,
    upcomingOpen: false,
    moveProposal: null,
    inactivateUnit: null,
    correction: null,
    cancelChange: null,
    inspectorOpen: Boolean(urlState.selectedId),
  });
  const {
    collapsed,
    unitForm,
    manageTypes,
    createType,
    createdTypeId,
    upcomingOpen,
    moveProposal,
    inactivateUnit,
    correction,
    cancelChange,
    inspectorOpen,
  } = local;
  const patchLocal = (value: Partial<OrganizationLocalState>) =>
    dispatchLocal({ type: "patch", value });
  const deferredSearch = useDeferredValue(urlState.search);

  const readiness = useOrganizationReadiness(canView);
  const hierarchy = useOrganizationHierarchy(urlState.asOf, canView);
  const moveHierarchy = useOrganizationHierarchy(
    moveProposal?.effectiveDate ?? urlState.asOf,
    canView &&
      moveProposal !== null &&
      moveProposal.effectiveDate !== urlState.asOf
  );
  const upcoming = useOrganizationUpcomingChanges(
    canView && readiness.data?.hasPermanentRoot === true
  );
  const search = useOrganizationSearch(deferredSearch, urlState.asOf, canView);
  const tenantSummary = useTenantAccessSummary(
    canView && canReadTenantName && readiness.data?.hasPermanentRoot === false
  );
  const needTypes =
    unitForm !== null || manageTypes || createType || correction !== null;
  const types = useOrganizationTypes(canView && needTypes);
  const mutations = useOrganizationMutations();
  const importApi = useOrganizationImportApi();
  const cancelUnit = useOrganizationUnit(
    cancelChange?.orgUnitId ?? null,
    cancelChange?.effectiveDate ?? today,
    canView && cancelChange !== null
  );

  const model = useMemo(
    () => (hierarchy.data ? buildOrganizationHierarchy(hierarchy.data) : null),
    [hierarchy.data]
  );
  const moveModel = useMemo(
    () =>
      !moveProposal || moveProposal.effectiveDate === urlState.asOf
        ? model
        : moveHierarchy.data
          ? buildOrganizationHierarchy(moveHierarchy.data)
          : null,
    [model, moveHierarchy.data, moveProposal, urlState.asOf]
  );

  function navigate(next: Partial<OrganizationUrlState>) {
    const state = { ...urlState, ...next };
    const query = writeOrganizationUrlState(state, today).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  useEffect(() => {
    if (!model || hierarchy.isFetching || !urlState.selectedId) return;
    if (!model.byId.has(urlState.selectedId)) {
      navigate({ selectedId: null });
      patchLocal({ inspectorOpen: false });
    }
    // Selection is reconciled only after this exact as-of hierarchy resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, hierarchy.isFetching, urlState.selectedId]);

  function select(id: string) {
    if (model) dispatchLocal({ type: "reveal", model, id });
    patchLocal({ inspectorOpen: true });
    navigate({ selectedId: id });
  }

  function toggle(id: string) {
    dispatchLocal({ type: "toggle-collapse", id });
  }

  function addChild(id: string) {
    if (!readOnly && canManage)
      patchLocal({ unitForm: { kind: "add", parentId: id } });
  }
  function stageMove(
    id: string,
    targetId: string | null,
    entry: "drag" | "explicit" = "explicit"
  ) {
    if (!model) return;
    const unit = model.byId.get(id);
    if (!unit) return;
    patchLocal({
      moveProposal: {
        sourceId: id,
        fromParentId: unit.parentId,
        toParentId: targetId,
        effectiveDate: today,
        version: unit.version,
        subordinateCount: model.descendantsById.get(id)?.size ?? 0,
        entry,
        error: null,
      },
    });
  }

  if (authLoading)
    return (
      <div className="p-6">
        <PageHeader title="Organization" />
        <StructureSkeleton />
      </div>
    );
  if (!canView)
    return (
      <div className="p-6">
        <PageHeader title="Organization" />
        <PagePermissionNotice
          title="Organization access required"
          description="You do not have permission to view this tenant’s Organization."
        />
      </div>
    );

  const futureRoot =
    readiness.data?.hasPermanentRoot &&
    !readiness.data.isPermanentRootEffective &&
    readiness.data.permanentRootFirstEffectiveDate;
  const futureChanges = (upcoming.data ?? []).filter(
    (change) => !change.isCancelled && change.effectiveDate > today
  );

  async function exportStructure() {
    try {
      const blob = await importApi.exportStructure(urlState.asOf);
      downloadBlob(blob, `Fusion-organization-${urlState.asOf}.xlsx`);
    } catch {
      toast.error("Structure could not be exported", {
        description: "Try again in a moment.",
      });
    }
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[680px] flex-col overflow-hidden">
      <header className="shrink-0 px-6 pt-5">
        <PageHeader
          title="Organization"
          description="Define how your organization is structured."
          className="mb-3"
          actions={
            readiness.data?.hasPermanentRoot ? (
              <>
                {futureChanges.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => patchLocal({ upcomingOpen: true })}
                  >
                    <Clock3 className="h-4 w-4" />
                    Upcoming changes · {futureChanges.length}
                  </Button>
                ) : null}
                <div className="flex items-center gap-2 rounded-xl border bg-background px-2 py-1">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">As of</span>
                  <Input
                    aria-label="Organization as-of date"
                    type="date"
                    value={urlState.asOf}
                    onChange={(event) => navigate({ asOf: event.target.value })}
                    className="h-7 w-[132px] border-0 p-1 shadow-none focus-visible:ring-0"
                  />
                </div>
              </>
            ) : undefined
          }
        />
        <div className="flex items-end justify-between border-b">
          <nav
            aria-label="Organization lenses"
            className="flex items-center gap-6"
          >
            <button className="border-b-2 border-primary pb-2.5 text-sm font-semibold">
              Structure
            </button>
          </nav>
        </div>
        {readOnly ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/35 px-3.5 py-1.5 text-sm">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Viewing {urlState.asOf}</span>
              <span className="text-muted-foreground">· Read only</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => navigate({ asOf: today })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Return to Today
            </Button>
          </div>
        ) : null}
      </header>

      {readiness.isLoading ? (
        <div className="flex-1 p-6">
          <StructureSkeleton />
        </div>
      ) : readiness.error ? (
        <div className="grid flex-1 place-items-center px-6">
          <Alert variant="destructive" className="max-w-xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Organization could not be resolved</AlertTitle>
            <AlertDescription>
              {readiness.error.message}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void readiness.refetch()}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : readiness.data && !readiness.data.hasPermanentRoot ? (
        <RootEstablishment
          canManage={canManage}
          today={today}
          tenantName={tenantSummary.data?.tenantName ?? null}
          mutations={mutations}
          onCreated={(id, effectiveDate) => {
            if (effectiveDate === today)
              navigate({ selectedId: id, representation: "chart" });
            else navigate({ asOf: effectiveDate, selectedId: id });
          }}
        />
      ) : futureRoot && urlState.asOf < futureRoot ? (
        <div className="mx-auto flex flex-1 max-w-2xl flex-col justify-center px-6">
          <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-warning-subtle text-warning">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">
            Organization scheduled for {futureRoot}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The permanent root exists, so another cannot be created. Today
            remains without an effective hierarchy.
          </p>
          <Button
            className="mt-5 w-fit"
            onClick={() =>
              navigate({
                asOf: futureRoot,
                selectedId: readiness.data?.permanentRootId ?? null,
              })
            }
          >
            View scheduled structure
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
            <div className="relative min-w-[280px] max-w-lg flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search Organization by name or business code"
                value={urlState.search}
                onChange={(event) => navigate({ search: event.target.value })}
                placeholder="Find a unit by name or code"
                className="pl-9 pr-9"
              />
              {urlState.search ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear Organization search"
                  onClick={() => navigate({ search: "" })}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {urlState.search.trim().length >= 2 ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
                  {search.isLoading ? (
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : search.data?.length ? (
                    search.data.map((unit) => (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => {
                          select(unit.id);
                          navigate({ search: "", selectedId: unit.id });
                        }}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left outline-none hover:bg-muted focus-visible:bg-muted"
                      >
                        <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {unit.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {unit.path} · {unit.code}
                          </span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm font-medium">No units found</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Try another name or business code.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => navigate({ search: "" })}
                      >
                        Clear search
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <ToggleGroup
              type="single"
              value={urlState.representation}
              onValueChange={(value) => {
                if (value === "chart" || value === "outline")
                  navigate({ representation: value });
              }}
              aria-label="Structure representation"
              className="rounded-lg border bg-muted/40 p-0.5"
            >
              <ToggleGroupItem
                value="chart"
                aria-label="Chart view"
                className="gap-1.5 px-3 text-sm text-muted-foreground data-[state=on]:bg-foreground! data-[state=on]:text-background! data-[state=on]:shadow-sm"
              >
                <Network className="h-4 w-4" />
                Chart
              </ToggleGroupItem>
              <ToggleGroupItem
                value="outline"
                aria-label="Outline view"
                className="gap-1.5 px-3 text-sm text-muted-foreground data-[state=on]:bg-foreground! data-[state=on]:text-background! data-[state=on]:shadow-sm"
              >
                <ListTree className="h-4 w-4" />
                Outline
              </ToggleGroupItem>
            </ToggleGroup>
            {canManage && !readOnly ? (
              <>
                <Button
                  onClick={() =>
                    patchLocal({ unitForm: { kind: "add", parentId: null } })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add unit
                </Button>
                <Button asChild variant="outline">
                  <Link href="/organization/import">
                    <Upload className="h-4 w-4" />
                    Import structure
                  </Link>
                </Button>
              </>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More Organization actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void exportStructure()}>
                  <FileOutput className="h-4 w-4" />
                  Export structure
                </DropdownMenuItem>
                {canManage && !readOnly ? (
                  <DropdownMenuItem onClick={() => patchLocal({ manageTypes: true })}>
                    <Settings2 className="h-4 w-4" />
                    Manage Unit Types
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="relative flex min-h-0 flex-1">
            <main
              className="min-w-0 flex-1"
              aria-label="Organization Structure workspace"
            >
              {hierarchy.isLoading && !hierarchy.data ? (
                <StructureSkeleton />
              ) : hierarchy.error ? (
                <div className="grid h-full place-items-center p-6">
                  <Alert variant="destructive" className="max-w-xl">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      Structure unavailable for {urlState.asOf}
                    </AlertTitle>
                    <AlertDescription>
                      {hierarchy.error.message}
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void hierarchy.refetch()}
                        >
                          Retry
                        </Button>
                        {readOnly ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate({ asOf: today })}
                          >
                            Return to Today
                          </Button>
                        ) : null}
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : model && model.units.length ? (
                urlState.representation === "chart" ? (
                  <OrganizationChart
                    model={model}
                    collapsed={collapsed}
                    selectedId={urlState.selectedId}
                    canManage={canManage}
                    readOnly={readOnly}
                    onSelect={select}
                    onToggle={toggle}
                    onAddChild={addChild}
                    onStageDragMove={(source, target) =>
                      stageMove(source, target, "drag")
                    }
                  />
                ) : (
                  <OrganizationOutline
                    model={model}
                    collapsed={collapsed}
                    selectedId={urlState.selectedId}
                    canManage={canManage}
                    readOnly={readOnly}
                    onSelect={select}
                    onToggle={toggle}
                    onAddChild={addChild}
                    onStageDragMove={(source, target) =>
                      stageMove(source, target, "drag")
                    }
                  />
                )
              ) : (
                <div className="grid h-full place-items-center">
                  <p className="text-sm text-muted-foreground">
                    No Organizational Units resolve for this date.
                  </p>
                </div>
              )}
            </main>
            {model &&
            (unitForm !== null ||
              manageTypes ||
              correction !== null ||
              (urlState.selectedId && inspectorOpen)) ? (
              <aside
                className="min-h-0 w-[360px] shrink-0 border-l bg-background max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:shadow-xl"
                aria-label="Organization panel"
              >
                {unitForm !== null ? (
                  <UnitFormPanel
                    mode={unitForm}
                    today={today}
                    model={model}
                    types={types.data ?? []}
                    createdTypeId={createdTypeId}
                    mutations={mutations}
                    onClose={() =>
                      patchLocal({ unitForm: null, createdTypeId: null })
                    }
                    onCreateType={() => patchLocal({ createType: true })}
                    onSaved={(id, effectiveDate) => {
                      if (effectiveDate === today) select(id);
                    }}
                  />
                ) : correction !== null ? (
                  <CorrectionPanel
                    unit={correction.unit}
                    effectiveDate={correction.date}
                    model={model}
                    types={types.data ?? []}
                    mutations={mutations}
                    onClose={() => patchLocal({ correction: null })}
                    onDone={() => void hierarchy.refetch()}
                  />
                ) : manageTypes ? (
                  <ManageTypesPanel
                    types={types.data ?? []}
                    mutations={mutations}
                    onClose={() => patchLocal({ manageTypes: false })}
                    onCreateType={() => patchLocal({ createType: true })}
                  />
                ) : urlState.selectedId && inspectorOpen ? (
                  <InspectorContent
                    selectedId={urlState.selectedId}
                    asOf={urlState.asOf}
                    today={today}
                    canManage={canManage}
                    readOnly={readOnly}
                    model={model}
                    onClose={() => {
                      patchLocal({ inspectorOpen: false });
                      navigate({ selectedId: null });
                    }}
                    onEdit={(unit) =>
                      patchLocal({ unitForm: { kind: "edit", unit } })
                    }
                    onAddChild={addChild}
                    onMove={(id) => stageMove(id, null)}
                    onInactivate={(unit) =>
                      patchLocal({ inactivateUnit: unit })
                    }
                    onCorrect={(unit, date) =>
                      patchLocal({ correction: { unit, date } })
                    }
                  />
                ) : null}
              </aside>
            ) : null}
          </div>
        </>
      )}

      {model ? (
        <>
          <CreateTypeDialog
            open={createType}
            mutations={mutations}
            onOpenChange={(open) => patchLocal({ createType: open })}
            onCreated={(type) => {
              patchLocal({ createdTypeId: type.id });
              void types.refetch();
            }}
          />
          {moveProposal ? (
            <MoveReviewDialog
              proposal={moveProposal}
              today={today}
              model={moveModel ?? model}
              resolving={!moveModel || moveHierarchy.isFetching}
              mutations={mutations}
              onChange={(value) => patchLocal({ moveProposal: value })}
              onOpenChange={(open) => {
                if (!open) patchLocal({ moveProposal: null });
              }}
              onMoved={(id, effectiveDate) => {
                if (effectiveDate === today) select(id);
              }}
            />
          ) : null}
          <InactivateDialog
            unit={inactivateUnit}
            today={today}
            model={model}
            mutations={mutations}
            onOpenChange={(open) => {
              if (!open) patchLocal({ inactivateUnit: null });
            }}
            onDone={() => navigate({ selectedId: null })}
            onSelectDescendant={select}
          />
        </>
      ) : null}
      <UpcomingChangesSheet
        open={upcomingOpen}
        changes={futureChanges}
        canManage={canManage}
        today={today}
        mutations={mutations}
        onOpenChange={(open) => patchLocal({ upcomingOpen: open })}
        onViewDate={(date) => navigate({ asOf: date })}
        onCancel={(change) => patchLocal({ cancelChange: change })}
      />
      {cancelChange ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) patchLocal({ cancelChange: null });
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Cancel scheduled {eventLabel(cancelChange).toLowerCase()}?
              </DialogTitle>
              <DialogDescription>
                {cancelChange.unitName} will no longer change on{" "}
                {cancelChange.effectiveDate}. Other changes scheduled for that
                date remain.
              </DialogDescription>
            </DialogHeader>
            {cancelUnit.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Current version unavailable</AlertTitle>
                <AlertDescription>{cancelUnit.error.message}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => patchLocal({ cancelChange: null })}
              >
                Keep change
              </Button>
              <Button
                variant="destructive"
                disabled={!cancelUnit.data || mutations.cancelChange.isLoading}
                onClick={async () => {
                  if (!cancelUnit.data || mutations.cancelChange.isLoading)
                    return;
                  try {
                    await mutations.cancelChange.mutateAsync({
                      id: cancelChange.id,
                      version: cancelUnit.data.version,
                    });
                    toast.success("Scheduled change cancelled");
                    patchLocal({ cancelChange: null });
                  } catch {
                    return;
                  }
                }}
              >
                Cancel scheduled change
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
