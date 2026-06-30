"use client";

import { useMemo, useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
import { createPlatformApiClient } from "@repo/api";
import { useApiQuery, useApiMutation } from "@repo/api/query";
import { performancePaths, performanceQueryKeys } from "@repo/api";
import {
  canManageObjectiveLibrary,
  canViewObjectiveLibrary,
  hasCorePermission,
  useAuth,
} from "@repo/auth";
import type { CategoryDto, PagedResponse, TemplateSummaryDto } from "@repo/api";
import {
  PageContainer,
  PageEmpty,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
  PageToolbar,
  StatusBadge,
} from "@repo/ds/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TemplateEditor } from "./template-editor";
import { TemplateCategoriesManager } from "@/components/template-categories/template-categories-manager";
import {
  templateStatusLabel,
  templateStatusTone,
  labelMeasurementType,
} from "@/lib/labels";
import { toast } from "sonner";

type View = "list" | "create" | "edit";

const ALL = "__all__";
const PAGE_SIZE = 20;

export function TemplateLibraryPage() {
  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [measurementFilter, setMeasurementFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewObjectiveLibrary(user);
  const canManage = canManageObjectiveLibrary(user);
  const canManageCategories = hasCorePermission(user, "performance.template.category.manage", "Tenant");

  const queryParams = {
    search: search || null,
    status: statusFilter !== ALL ? statusFilter : null,
    categoryId: categoryFilter !== ALL ? categoryFilter : null,
    measurementType: measurementFilter !== ALL ? measurementFilter : null,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data: paged, refetch } = useApiQuery<PagedResponse<TemplateSummaryDto>>(
    performanceQueryKeys.templateLibrary(queryParams),
    (signal) => {
      const params = new URLSearchParams();
      if (queryParams.search) params.set("search", queryParams.search);
      if (queryParams.status) params.set("status", queryParams.status);
      if (queryParams.categoryId) params.set("categoryId", queryParams.categoryId);
      if (queryParams.measurementType) params.set("measurementType", queryParams.measurementType);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      return apiClient.get<PagedResponse<TemplateSummaryDto>>(
        `${performancePaths.templateLibrary()}?${params.toString()}`,
        { signal },
      );
    },
    { enabled: canView },
  );

  const { data: categories } = useApiQuery<CategoryDto[]>(
    [...performanceQueryKeys.templateCategories(), "with-archived"],
    (signal) =>
      apiClient.get<CategoryDto[]>(
        `${performancePaths.templateCategories()}?includeArchived=true`,
        { signal },
      ),
    { enabled: canManageCategories },
  );

  const categoryLookup = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories],
  );

  const duplicate = useApiMutation<TemplateSummaryDto, string>(
    (id) => apiClient.post<TemplateSummaryDto>(performancePaths.templateLibraryDuplicate(id), {}),
    {
      onSuccess: (result) => {
        toast.success("Template duplicated");
        void refetch();
        setEditingId(result.id);
        setView("edit");
      },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const archive = useApiMutation<TemplateSummaryDto, string>(
    (id) => apiClient.post<TemplateSummaryDto>(performancePaths.templateLibraryArchive(id), {}),
    {
      onSuccess: () => { toast.success("Template archived"); void refetch(); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const restore = useApiMutation<TemplateSummaryDto, string>(
    (id) => apiClient.post<TemplateSummaryDto>(performancePaths.templateLibraryRestore(id), {}),
    {
      onSuccess: () => { toast.success("Template restored"); void refetch(); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  if (authLoading) return <PageLoading label="Loading…" />;

  if (!canView) {
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Access restricted"
          description="You do not have access to the template library for this tenant."
        />
      </PageContainer>
    );
  }

  if (view === "create") {
    return (
      <PageContainer>
        <TemplateEditor
          mode="create"
          onSaved={() => { void refetch(); setView("list"); }}
          onCancel={() => setView("list")}
        />
      </PageContainer>
    );
  }

  if (view === "edit" && editingId) {
    return (
      <PageContainer>
        <TemplateEditor
          mode="edit"
          templateId={editingId}
          onSaved={() => { void refetch(); setView("list"); }}
          onCancel={() => setView("list")}
        />
      </PageContainer>
    );
  }

  const templates = paged?.items ?? [];
  const hasFilters = search || statusFilter !== ALL || categoryFilter !== ALL || measurementFilter !== ALL;

  return (
    <PageContainer>
      <PageHeader
        title="Objective templates"
        description="Reusable templates for performance plans — browse, search, and manage your template library."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setView("create")}>
              <Plus className="h-4 w-4 mr-1.5" />
              New template
            </Button>
          ) : undefined
        }
      />

      {canManageCategories && <TemplateCategoriesManager />}

      <PageToolbar>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-56"
          />
          <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          {canManageCategories && categories && categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={handleFilterChange(setCategoryFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={measurementFilter} onValueChange={handleFilterChange(setMeasurementFilter)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Measurement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All measurement types</SelectItem>
              <SelectItem value="Quantitative">Numeric targets</SelectItem>
              <SelectItem value="Qualitative">Qualitative outcomes</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch(""); setStatusFilter(ALL); setCategoryFilter(ALL);
                setMeasurementFilter(ALL); setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </PageToolbar>

      <div className="space-y-2">
        {templates.map((t) => {
          const revision = t.activeRevision ?? t.draftRevision;
          const category = revision?.categoryId ? (categoryLookup.get(revision.categoryId) ?? null) : null;
          const hasDraft = !!t.draftRevision;
          return (
            <Card key={t.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {revision?.title ?? "(untitled draft)"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {revision?.measurementType && (
                      <span>{labelMeasurementType(revision.measurementType)}</span>
                    )}
                    {category && (
                      <span>
                        {category.name}
                        {category.status === "Archived" ? " (archived)" : ""}
                      </span>
                    )}
                    {revision?.applicabilityValidationState === "HasUnresolved" && (
                      <span className="text-amber-600">
                        A selected organisation value is no longer available
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge tone={templateStatusTone(t.status, hasDraft)} dot>
                    {templateStatusLabel(t.status, hasDraft)}
                  </StatusBadge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => { setEditingId(t.id); setView("edit"); }}
                  >
                    Edit
                  </Button>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => duplicate.mutate(t.id)}
                          disabled={duplicate.isLoading}
                        >
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {t.status !== "Archived" ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => archive.mutate(t.id)}
                            disabled={archive.isLoading}
                          >
                            Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => restore.mutate(t.id)}
                            disabled={restore.isLoading}
                          >
                            Restore
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {paged && templates.length === 0 && (
          <PageEmpty
            title={hasFilters ? "No templates match these filters" : "No templates yet"}
            description={
              hasFilters
                ? "Try adjusting your search or filters."
                : "Create a template to start building your objective library."
            }
            action={
              canManage && !hasFilters ? (
                <Button size="sm" onClick={() => setView("create")}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New template
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      {paged && paged.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm pt-2">
          <span className="text-muted-foreground">
            {paged.totalCount} template{paged.totalCount !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!paged.hasPreviousPage} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-muted-foreground">{paged.page} / {paged.totalPages}</span>
            <Button variant="outline" size="sm" disabled={!paged.hasNextPage} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
