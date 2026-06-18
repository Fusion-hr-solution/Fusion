"use client";

import { useMemo, useState } from "react";
import { Library, Pencil, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ds";
import { EmptyState } from "@repo/ui";
import {
  canManageObjectiveLibrary,
  canViewObjectiveLibrary,
  useAuth,
} from "@repo/auth";
import type {
  CreateObjectiveTemplateRequest,
  ObjectiveTemplateDto,
} from "@repo/api";
import { ObjectiveTemplateDialog } from "@/components/objective-template-dialog";
import {
  useCreateObjectiveTemplate,
  useObjectiveTemplates,
  useSetObjectiveTemplateArchived,
  useUpdateObjectiveTemplate,
} from "@/hooks/use-objective-templates";

const STATUS_FILTERS = ["Active", "Archived", "All"] as const;

export default function ObjectivesPage() {
  const { user } = useAuth();
  const canView = canViewObjectiveLibrary(user);
  const canManage = canManageObjectiveLibrary(user);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("Active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ObjectiveTemplateDto | null>(null);

  const params = useMemo(
    () => ({
      search: search || null,
      status: status === "All" ? null : status,
      category: null,
      page: 1,
      pageSize: 50,
    }),
    [search, status]
  );

  const { data, isLoading, error } = useObjectiveTemplates(params, canView);
  const createTemplate = useCreateObjectiveTemplate();
  const updateTemplate = useUpdateObjectiveTemplate(editing?.id ?? "");
  const setArchived = useSetObjectiveTemplateArchived();

  if (!canView) {
    return (
      <div className="container mx-auto px-4 py-12">
        <EmptyState icon={Library} title="You do not have access to the objective library" />
      </div>
    );
  }

  const templates = data?.items ?? [];

  const handleSubmit = (payload: CreateObjectiveTemplateRequest) => {
    if (editing) {
      updateTemplate
        .mutateAsync({ version: editing.version, body: payload })
        .then(() => {
          setDialogOpen(false);
          setEditing(null);
        })
        .catch(() => {
          /* error surfaced via updateTemplate.error */
        });
    } else {
      createTemplate
        .mutateAsync(payload)
        .then(() => setDialogOpen(false))
        .catch(() => {
          /* error surfaced via createTemplate.error */
        });
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (template: ObjectiveTemplateDto) => {
    setEditing(template);
    setDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Objective library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reusable objective templates for performance planning.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New template
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <EmptyState icon={Library} title="Could not load templates" description={error.message} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No objective templates"
          description={canManage ? "Create your first reusable objective." : "No templates available."}
          action={canManage ? { label: "New template", onClick: openCreate } : undefined}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Default weight</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="w-32 text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tmpl) => (
                <TableRow key={tmpl.id}>
                  <TableCell className="font-medium">{tmpl.name}</TableCell>
                  <TableCell className="text-muted-foreground">{tmpl.category ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {tmpl.defaultWeight != null ? `${tmpl.defaultWeight}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tmpl.status === "Active" ? "secondary" : "outline"}>
                      {tmpl.status}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(tmpl)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setArchived.mutate({
                              templateId: tmpl.id,
                              version: tmpl.version,
                              archived: tmpl.status === "Active",
                            })
                          }
                          disabled={setArchived.isLoading}
                        >
                          {tmpl.status === "Active" ? "Archive" : "Restore"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ObjectiveTemplateDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        template={editing}
        submitting={createTemplate.isLoading || updateTemplate.isLoading}
        errorMessage={(createTemplate.error ?? updateTemplate.error)?.message ?? null}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
