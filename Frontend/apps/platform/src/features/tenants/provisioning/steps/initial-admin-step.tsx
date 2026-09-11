"use client";

import { useMemo } from "react";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { Input } from "@repo/ds/components/ui/input";
import { Switch } from "@repo/ds/components/ui/switch";
import { Field, describedBy } from "../field";
import { ADMIN_ROLE_OPTIONS, adminRoleByValue } from "../admin-role-options";
import { SearchableSelect } from "../searchable-select";
import { StepPanel } from "./step-panel";
import type { ProvisioningStepProps } from "./types";

/**
 * Who establishes access to the tenant. The left column captures the person and
 * the role they receive; the right restates, in plain terms, what provisioning
 * will actually do for them — so the commitment is legible before it is made.
 */
export function InitialAdminStep({
  draft,
  errors,
  update,
  validateField,
}: ProvisioningStepProps) {
  const role = adminRoleByValue(draft.adminRole);

  const roleOptions = useMemo(
    () =>
      ADMIN_ROLE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        keywords: `${option.label} ${option.summary}`,
      })),
    []
  );

  return (
    <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <StepPanel
        title="Initial administrator"
        description="This person will receive an invitation to access the new tenant and complete the initial setup."
        className="h-full"
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="admin-first-name"
              label="First name"
              required
              error={errors.firstName}
            >
              <Input
                id="admin-first-name"
                value={draft.firstName}
                placeholder="e.g. John"
                autoComplete="given-name"
                onChange={(event) => update("firstName", event.target.value)}
                onBlur={() => validateField("firstName")}
                aria-invalid={Boolean(errors.firstName)}
                aria-describedby={describedBy(
                  "admin-first-name",
                  Boolean(errors.firstName)
                )}
              />
            </Field>

            <Field
              id="admin-last-name"
              label="Last name"
              required
              error={errors.lastName}
            >
              <Input
                id="admin-last-name"
                value={draft.lastName}
                placeholder="e.g. Doe"
                autoComplete="family-name"
                onChange={(event) => update("lastName", event.target.value)}
                onBlur={() => validateField("lastName")}
                aria-invalid={Boolean(errors.lastName)}
                aria-describedby={describedBy(
                  "admin-last-name",
                  Boolean(errors.lastName)
                )}
              />
            </Field>
          </div>

          <Field
            id="administrator-email"
            label="Work email"
            required
            hint="An invitation will be sent to this email address."
            error={errors.administratorEmail}
          >
            <Input
              id="administrator-email"
              type="email"
              value={draft.administratorEmail}
              placeholder="e.g. john.doe@acmecorp.com"
              autoComplete="email"
              // Validated on blur, never while typing: an address is invalid for
              // most of the time it is being entered.
              onBlur={() => validateField("administratorEmail")}
              onChange={(event) =>
                update("administratorEmail", event.target.value)
              }
              aria-invalid={Boolean(errors.administratorEmail)}
              aria-describedby={describedBy(
                "administrator-email",
                Boolean(errors.administratorEmail)
              )}
            />
          </Field>

          <Field id="admin-role" label="Role" hint={role.hint}>
            <SearchableSelect
              id="admin-role"
              options={roleOptions}
              value={draft.adminRole}
              placeholder="Select a role"
              searchPlaceholder="Search roles"
              emptyMessage="No role matches."
              onChange={(value) => update("adminRole", value)}
            />
          </Field>

          <label className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <span className="type-label text-foreground">
              Send invitation immediately
            </span>
            <Switch
              checked={draft.sendInvitation}
              onCheckedChange={(next) => update("sendInvitation", next)}
              aria-label="Send invitation immediately"
            />
            <span className="text-xs text-muted-foreground">
              {draft.sendInvitation
                ? "An invitation email will be sent when the tenant is provisioned."
                : "The invitation can be sent later from the tenant's administrators."}
            </span>
          </label>
        </div>
      </StepPanel>

      <div className="flex h-full flex-col gap-6 rounded-2xl border border-border bg-card p-6">
        <div>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className="type-subsection-title text-foreground">
                What will this person receive?
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                After provisioning, we will:
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {[
              draft.sendInvitation
                ? "Send an invitation email"
                : "Prepare an invitation to send later",
              "Provide initial access to the tenant",
              "Assign the selected role and permissions",
              "Allow them to continue the tenant setup",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-6 shrink-0 text-success"
                />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto">
          <p className="type-eyebrow mb-2 text-muted-foreground">
            Role summary
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h4 className="type-subsection-title text-foreground">
                {role.label}
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {role.summary}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
