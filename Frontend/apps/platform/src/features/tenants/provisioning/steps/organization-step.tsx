"use client";

import { useRef } from "react";
import { Building2, Lightbulb } from "lucide-react";
import { Input } from "@repo/ds/components/ui/input";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { Field, describedBy } from "../field";
import { StepPanel } from "./step-panel";
import type { ProvisioningStepProps } from "./types";

const DESCRIPTION_LIMIT = 500;

/** A URL-safe slug derived from a display name. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Who the tenant is. The left column captures its identity; the right explains
 * what a tenant is and how to name it well, so the operator is not guessing at
 * conventions the platform relies on.
 */
export function OrganizationStep({
  draft,
  errors,
  update,
  validateField,
}: ProvisioningStepProps) {
  // The slug follows the name until the operator writes their own, at which
  // point it is theirs to control and the suggestion stops overwriting it.
  const slugEdited = useRef(draft.tenantSlug.length > 0);

  function onNameChange(value: string) {
    update("name", value);
    if (!slugEdited.current) {
      update("tenantSlug", slugify(value));
    }
  }

  function onSlugChange(value: string) {
    slugEdited.current = true;
    update("tenantSlug", value);
  }

  const descriptionLength = draft.shortDescription.length;

  return (
    <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <StepPanel
        title="Organization details"
        description="Provide the basic information for the new tenant workspace."
        className="h-full"
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="tenant-name"
              label="Tenant name"
              required
              error={errors.name}
            >
              <Input
                id="tenant-name"
                value={draft.name}
                placeholder="e.g. Acme Corporation"
                autoComplete="organization"
                onChange={(event) => onNameChange(event.target.value)}
                onBlur={() => validateField("name")}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={describedBy(
                  "tenant-name",
                  Boolean(errors.name)
                )}
              />
            </Field>

            <Field
              id="tenant-slug"
              label="Tenant slug"
              required
              error={errors.tenantSlug}
            >
              <Input
                id="tenant-slug"
                value={draft.tenantSlug}
                placeholder="e.g. acme"
                spellCheck={false}
                onChange={(event) => onSlugChange(event.target.value)}
                onBlur={() => validateField("tenantSlug")}
                aria-invalid={Boolean(errors.tenantSlug)}
                aria-describedby={describedBy(
                  "tenant-slug",
                  Boolean(errors.tenantSlug)
                )}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="legal-entity-name" label="Legal entity name (optional)">
              <Input
                id="legal-entity-name"
                value={draft.legalEntityName}
                placeholder="e.g. Acme Corporation Ltd."
                onChange={(event) =>
                  update("legalEntityName", event.target.value)
                }
              />
            </Field>

            <Field
              id="internal-reference-code"
              label="Internal reference code (optional)"
            >
              <Input
                id="internal-reference-code"
                value={draft.internalReferenceCode}
                placeholder="e.g. ACME-001"
                onChange={(event) =>
                  update("internalReferenceCode", event.target.value)
                }
              />
            </Field>
          </div>

          <Field id="short-description" label="Short description (optional)">
            <div className="relative">
              <Textarea
                id="short-description"
                value={draft.shortDescription}
                placeholder="e.g. Global headquarters workspace for Acme Corporation."
                rows={3}
                maxLength={DESCRIPTION_LIMIT}
                className="resize-none pb-6"
                onChange={(event) =>
                  update("shortDescription", event.target.value)
                }
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-xs tabular-nums text-muted-foreground">
                {descriptionLength}/{DESCRIPTION_LIMIT}
              </span>
            </div>
          </Field>
        </div>
      </StepPanel>

      <div className="flex h-full flex-col gap-5 rounded-2xl border border-border bg-card p-6">
        <div>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="type-subsection-title text-foreground">
                About tenant setup
              </h3>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Each tenant is a separate workspace with its own users, data, and
            configuration. You can provision multiple tenants.
          </p>
        </div>

        <div className="border-t border-border" />

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb aria-hidden="true" className="size-6 text-primary" />
            <h3 className="type-subsection-title text-foreground">
              Naming guidance
            </h3>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {[
              "Choose a clear, recognizable name.",
              "The tenant slug must be unique.",
              "Use lowercase letters, numbers, and hyphens only.",
              "You can always update these details later.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 size-1 shrink-0 rounded-full bg-primary"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
