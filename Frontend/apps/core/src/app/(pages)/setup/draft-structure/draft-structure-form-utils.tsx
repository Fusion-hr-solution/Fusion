"use client";

import type {
  Control,
  FieldErrors,
  FieldPath,
} from "react-hook-form";
import { Controller } from "react-hook-form";
import type {
  DraftOrgUnitDto,
  DraftStructureAttributeDefinitionDto,
  DraftStructureSchemaDto,
} from "@repo/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNSET_VALUE = "__unset__";

export interface DraftOrgUnitFormValues {
  referenceKey: string;
  displayName: string;
  orgUnitKindKey: string;
  location: string;
  description: string;
  parentId: string | null;
  attributes: Record<string, unknown>;
}

export function getApplicableAttributes(
  schema: DraftStructureSchemaDto,
  orgUnitKindKey: string
) {
  const normalizedKindKey = orgUnitKindKey.trim().toLowerCase();

  return schema.attributes.filter((attribute) => {
    if (!attribute.appliesToKindKeys || attribute.appliesToKindKeys.length === 0) {
      return true;
    }

    return attribute.appliesToKindKeys.some(
      (kindKey) => kindKey.toLowerCase() === normalizedKindKey
    );
  });
}

export function createDraftOrgUnitFormValues(
  schema: DraftStructureSchemaDto,
  unit?: DraftOrgUnitDto | null
): DraftOrgUnitFormValues {
  return {
    referenceKey: unit?.referenceKey ?? "",
    displayName: unit?.displayName ?? "",
    orgUnitKindKey: unit?.orgUnitKindKey ?? schema.orgUnitKinds[0]?.key ?? "",
    location: unit?.location ?? "",
    description: unit?.description ?? "",
    parentId: unit?.parentId ?? null,
    attributes: normalizeAttributeValues(unit?.attributes ?? {}),
  };
}

export function sanitizeDraftAttributes(
  schema: DraftStructureSchemaDto,
  orgUnitKindKey: string,
  attributes: Record<string, unknown> | null | undefined
) {
  if (!attributes) {
    return null;
  }

  const applicableKeys = new Set(
    getApplicableAttributes(schema, orgUnitKindKey).map((attribute) => attribute.key)
  );
  const sanitizedEntries = Object.entries(attributes).filter(([key, value]) => {
    if (!applicableKeys.has(key)) {
      return false;
    }

    if (value == null) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return true;
  });

  if (sanitizedEntries.length === 0) {
    return null;
  }

  return Object.fromEntries(sanitizedEntries);
}

export function formatUnitOptionLabel(unit: DraftOrgUnitDto) {
  return `${unit.displayName} (${unit.referenceKey})`;
}

export function buildDraftOrgUnitKindKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function DraftStructureAttributeFields({
  schema,
  selectedKindKey,
  control,
  errors,
}: {
  schema: DraftStructureSchemaDto;
  selectedKindKey: string;
  control: Control<DraftOrgUnitFormValues>;
  errors: FieldErrors<DraftOrgUnitFormValues>;
}) {
  const attributes = getApplicableAttributes(schema, selectedKindKey);

  if (attributes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Additional optional fields</p>
        <p className="text-sm text-muted-foreground">
          These fields are still validated against the tenant structure schema,
          but they are secondary to the main hierarchy fields.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {attributes.map((attribute) => (
          <DraftAttributeField
            key={attribute.key}
            attribute={attribute}
            control={control}
            errors={errors}
          />
        ))}
      </div>
    </div>
  );
}

function DraftAttributeField({
  attribute,
  control,
  errors,
}: {
  attribute: DraftStructureAttributeDefinitionDto;
  control: Control<DraftOrgUnitFormValues>;
  errors: FieldErrors<DraftOrgUnitFormValues>;
}) {
  const fieldName = `attributes.${attribute.key}` as FieldPath<DraftOrgUnitFormValues>;
  const attributeErrors = errors.attributes as Record<string, { message?: string }> | undefined;
  const errorMessage = attributeErrors?.[attribute.key]?.message;

  return (
    <div className="grid gap-2">
      <Label>{attribute.displayLabel}</Label>
      <Controller
        control={control}
        name={fieldName}
        rules={
          attribute.required
            ? { required: `${attribute.displayLabel} is required` }
            : undefined
        }
        render={({ field }) => {
          if (attribute.valueType === "singleSelect") {
            return (
              <Select
                value={toSelectValue(field.value)}
                onValueChange={(value) => {
                  field.onChange(value === UNSET_VALUE ? undefined : value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Select ${attribute.displayLabel}`} />
                </SelectTrigger>
                <SelectContent>
                  {!attribute.required && (
                    <SelectItem value={UNSET_VALUE}>Not set</SelectItem>
                  )}
                  {(attribute.allowedValues ?? []).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }

          if (attribute.valueType === "boolean") {
            return (
              <Select
                value={toBooleanSelectValue(field.value)}
                onValueChange={(value) => {
                  if (value === UNSET_VALUE) {
                    field.onChange(undefined);
                    return;
                  }

                  field.onChange(value === "true");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Select ${attribute.displayLabel}`} />
                </SelectTrigger>
                <SelectContent>
                  {!attribute.required && (
                    <SelectItem value={UNSET_VALUE}>Not set</SelectItem>
                  )}
                  <SelectItem value="true">True</SelectItem>
                  <SelectItem value="false">False</SelectItem>
                </SelectContent>
              </Select>
            );
          }

          return (
            <Input
              type={attribute.valueType === "date" ? "date" : attribute.valueType === "number" ? "number" : "text"}
              value={field.value == null ? "" : String(field.value)}
              onChange={(event) => field.onChange(event.target.value)}
              placeholder={attribute.displayLabel}
            />
          );
        }}
      />
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}

function normalizeAttributeValues(attributes: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        return [key, JSON.stringify(value)];
      }

      return [key, value];
    })
  );
}

function toSelectValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toBooleanSelectValue(value: unknown) {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return undefined;
}