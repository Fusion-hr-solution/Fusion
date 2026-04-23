"use client";

import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Building2, Globe } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getServiceLines, deleteServiceLine } from "@/services/admin-service";
import type { AdminServiceLine } from "@/types/admin";
import { ServiceLineForm } from "./service-line-form";

export function ServiceLinesManager() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchServiceLines = useCallback(() => getServiceLines(), []);
  const { data: serviceLines, isLoading, refetch } = useApiQuery<AdminServiceLine[]>(
    fetchServiceLines,
    { enabled: true },
  );

  const { mutateAsync: doDelete } = useApiMutation(
    (id: string) => deleteServiceLine(id),
    { onSuccess: () => refetch() },
  );

  const handleDelete = useCallback(
    async (sl: AdminServiceLine) => {
      if (!confirm(`Delete service line "${sl.name}"?`)) return;
      await doDelete(sl.id);
    },
    [doDelete],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Manage Service Lines
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define service lines for curriculum mapping
          </p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="ey-bg-dark hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Service Line
        </Button>
      </div>

      {showCreate && (
        <ServiceLineForm
          onSaved={() => { setShowCreate(false); refetch(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading service lines...
        </div>
      ) : !serviceLines?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No service lines yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceLines.map((sl) =>
            editingId === sl.id ? (
              <ServiceLineForm
                key={sl.id}
                serviceLine={sl}
                onSaved={() => { setEditingId(null); refetch(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={sl.id} className="border-border/60">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: sl.color }}
                      />
                      <CardTitle className="text-sm font-semibold">{sl.name}</CardTitle>
                    </div>
                    {sl.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {sl.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingId(sl.id); setShowCreate(false); }}
                      aria-label={`Edit ${sl.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(sl)}
                      aria-label={`Delete ${sl.name}`}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{sl.code}</Badge>
                  {sl.isSharedAcrossAllServiceLines && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Globe className="h-3 w-3" /> Shared
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
