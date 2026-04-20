"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { PencilLine, Plus, Trash2 } from "lucide-react";
import { ApiError, type DraftOrgUnitDto, type DraftStructureSchemaDto } from "@repo/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { buildDraftOrgUnitKindKey } from "./draft-structure-form-utils";
import { useTenantSettings, useUpdateTenantSettings } from "./use-tenant-settings";

interface EditableOrgUnitKind {
  id: string;
  key: string;
  displayLabel: string;
  isNew: boolean;
}

interface DraftOrgUnitKindManagerProps {
  schema: DraftStructureSchemaDto;
  existingUnits: DraftOrgUnitDto[];
  onSchemaUpdated: (schema: DraftStructureSchemaDto) => void;
  currentKindKey?: string;
  disabled?: boolean;
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
}

function createEditableKinds(schema: DraftStructureSchemaDto): EditableOrgUnitKind[] {
  return schema.orgUnitKinds.map((kind) => ({
    id: kind.key,
    key: kind.key,
    displayLabel: kind.displayLabel,
    isNew: false,
  }));
}

function buildSchemaWithKinds(
  schema: DraftStructureSchemaDto,
  kinds: EditableOrgUnitKind[]
): DraftStructureSchemaDto {
  const nextKinds = kinds.map((kind) => {
    const key = kind.isNew ? buildDraftOrgUnitKindKey(kind.displayLabel) : kind.key;

    return {
      key,
      displayLabel: kind.displayLabel.trim(),
    };
  });
  const validKindKeys = new Set(nextKinds.map((kind) => kind.key));

  return {
    orgUnitKinds: nextKinds,
    attributes: schema.attributes.flatMap((attribute) => {
      if (!attribute.appliesToKindKeys || attribute.appliesToKindKeys.length === 0) {
        return [attribute];
      }

      const nextAppliesToKindKeys = attribute.appliesToKindKeys.filter((kindKey) =>
        validKindKeys.has(kindKey)
      );

      if (nextAppliesToKindKeys.length === 0) {
        return [];
      }

      return [
        {
          ...attribute,
          appliesToKindKeys: nextAppliesToKindKeys,
        },
      ];
    }),
  };
}

export function DraftOrgUnitKindManager({
  schema,
  existingUnits,
  onSchemaUpdated,
  currentKindKey,
  disabled = false,
  triggerLabel = "Manage types",
  triggerVariant = "outline",
  triggerSize = "sm",
}: DraftOrgUnitKindManagerProps) {
  const [open, setOpen] = useState(false);
  const [draftKinds, setDraftKinds] = useState<EditableOrgUnitKind[]>(() =>
    createEditableKinds(schema)
  );
  const [newKindLabel, setNewKindLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const nextNewId = useRef(0);

  const {
    data: settings,
    error: settingsError,
    isLoading: isSettingsLoading,
    refetch: refetchSettings,
  } = useTenantSettings(open);
  const updateSettings = useUpdateTenantSettings({
    onSuccess: (data) => {
      toast.success("Unit types updated");
      onSchemaUpdated(data.draftStructureSchema);
      setOpen(false);
    },
  });

  const draftUsageByKind = useMemo(() => {
    return existingUnits.reduce<Record<string, number>>((counts, unit) => {
      counts[unit.orgUnitKindKey] = (counts[unit.orgUnitKindKey] ?? 0) + 1;
      return counts;
    }, {});
  }, [existingUnits]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftKinds(createEditableKinds(schema));
    setNewKindLabel("");
    setErrorMessage(null);
  }, [open, schema]);

  const addKind = () => {
    const displayLabel = newKindLabel.trim();
    const key = buildDraftOrgUnitKindKey(displayLabel);

    if (!displayLabel) {
      setErrorMessage("Enter a unit type name before adding it.");
      return;
    }

    if (!key) {
      setErrorMessage("Unit type names must include at least one letter or number.");
      return;
    }

    if (
      draftKinds.some((kind) => kind.key.toLowerCase() === key.toLowerCase()) ||
      draftKinds.some(
        (kind) => kind.displayLabel.trim().toLowerCase() === displayLabel.toLowerCase()
      )
    ) {
      setErrorMessage("That unit type already exists.");
      return;
    }

    setDraftKinds((currentKinds) => [
      ...currentKinds,
      {
        id: `new-kind-${nextNewId.current++}`,
        key,
        displayLabel,
        isNew: true,
      },
    ]);
    setNewKindLabel("");
    setErrorMessage(null);
  };

  const updateKindLabel = (kindId: string, displayLabel: string) => {
    setDraftKinds((currentKinds) =>
      currentKinds.map((kind) => {
        if (kind.id !== kindId) {
          return kind;
        }

        return {
          ...kind,
          displayLabel,
          key: kind.isNew ? buildDraftOrgUnitKindKey(displayLabel) : kind.key,
        };
      })
    );
    setErrorMessage(null);
  };

  const removeKind = (kindId: string) => {
    setDraftKinds((currentKinds) => currentKinds.filter((kind) => kind.id !== kindId));
    setErrorMessage(null);
  };

  const saveKinds = async () => {
    const nextSchema = buildSchemaWithKinds(schema, draftKinds);
    const normalizedLabels = nextSchema.orgUnitKinds.map((kind) => kind.displayLabel.trim());

    if (nextSchema.orgUnitKinds.length === 0) {
      setErrorMessage("Keep at least one unit type available.");
      return;
    }

    if (nextSchema.orgUnitKinds.some((kind) => !kind.displayLabel || !kind.key)) {
      setErrorMessage("Every unit type needs a valid name.");
      return;
    }

    if (
      nextSchema.orgUnitKinds
        .map((kind) => kind.key.toLowerCase())
        .filter((key, index, keys) => keys.indexOf(key) !== index).length > 0
    ) {
      setErrorMessage("Unit type names must resolve to unique keys.");
      return;
    }

    if (
      normalizedLabels
        .map((label) => label.toLowerCase())
        .filter((label, index, labels) => labels.indexOf(label) !== index).length > 0
    ) {
      setErrorMessage("Unit type names must be unique.");
      return;
    }

    setErrorMessage(null);

    try {
      await updateSettings.mutateAsync({
        expectedVersion: settings?.version ?? null,
        input: {
          draftStructureSchema: nextSchema,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.errors.join(", "));
      } else {
        setErrorMessage("An unexpected error occurred.");
      }
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <PencilLine className="size-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage unit types</DialogTitle>
            <DialogDescription>
              Keep the list tight and reusable. Deleting a type only works when
              no saved draft units use it, and fields tied only to a removed
              type are pruned from the schema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              {draftKinds.map((kind) => {
                const usageCount = draftUsageByKind[kind.key] ?? 0;
                const isCurrentKind = currentKindKey === kind.key;
                const deleteHint = usageCount > 0
                  ? `${usageCount} saved draft unit${usageCount === 1 ? " uses" : "s use"} this type`
                  : isCurrentKind
                    ? "Currently selected in this form"
                    : null;

                return (
                  <div key={kind.id} className="rounded-xl border p-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor={`unit-kind-${kind.id}`}>Type name</Label>
                        <Input
                          id={`unit-kind-${kind.id}`}
                          value={kind.displayLabel}
                          onChange={(event) => updateKindLabel(kind.id, event.target.value)}
                          placeholder="Department"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono uppercase tracking-[0.14em]">
                            {kind.key || "pending-key"}
                          </span>
                          {usageCount > 0 ? (
                            <Badge variant="outline">
                              {usageCount} planned unit{usageCount === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                          {isCurrentKind ? (
                            <Badge variant="secondary">Selected here</Badge>
                          ) : null}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${kind.displayLabel || "unit type"}`}
                        onClick={() => removeKind(kind.id)}
                        disabled={usageCount > 0 || isCurrentKind}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {deleteHint ? (
                      <p className="mt-2 text-xs text-muted-foreground">{deleteHint}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-dashed p-4">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="new-unit-type">New unit type</Label>
                  <Input
                    id="new-unit-type"
                    value={newKindLabel}
                    onChange={(event) => setNewKindLabel(event.target.value)}
                    placeholder="Division"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addKind();
                      }
                    }}
                  />
                </div>
                <Button type="button" onClick={addKind}>
                  <Plus className="size-4" />
                  Add type
                </Button>
              </div>
            </div>

            {settingsError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{settingsError.message}</span>
                  <Button type="button" variant="outline" size="sm" onClick={refetchSettings}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={saveKinds}
              disabled={isSettingsLoading || updateSettings.isLoading || !!settingsError}
            >
              {isSettingsLoading || updateSettings.isLoading ? <Spinner className="mr-1" /> : null}
              Save types
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}