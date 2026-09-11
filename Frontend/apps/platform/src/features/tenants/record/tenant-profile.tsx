"use client";

import { useEffect, useState } from "react";
import { FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { failureMessage, type TenantDetail } from "../api";
import { formatDate } from "../language";
import { useRenameTenant } from "../queries";
import { useTenantRecord } from "./record-shell";

/**
 * The tenant profile.
 *
 * The stable, platform-owned facts established at provisioning, read at a
 * glance. Only the organization display name is editable here — the tenant key,
 * created date, and internal id are immutable, and locale/time zone are shown as
 * their provisioning origin rather than as a second place to change what the
 * customer workspace owns.
 */
export function TenantProfile() {
  const { tenant } = useTenantRecord();
  const [editing, setEditing] = useState(false);

  const rows: { label: string; value: string }[] = [
    { label: "Organization name", value: tenant.name },
    { label: "Default timezone", value: tenant.timeZone },
    { label: "Default locale", value: localeLabel(tenant.locale) },
    { label: "Provisioned", value: formatDate(tenant.createdAt) },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText
            aria-hidden="true"
            className="size-5 text-muted-foreground"
          />
          <h3 className="text-sm font-semibold text-foreground">
            Tenant profile
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      </header>

      <dl className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-baseline gap-10 py-2.5"
          >
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 truncate text-sm font-medium text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <RenameDialog tenant={tenant} open={editing} onOpenChange={setEditing} />
    </section>
  );
}

/**
 * Renaming the organization display name. It is the one profile field Platform
 * owns and may change; the tenant key does not move with it.
 */
function RenameDialog({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: TenantDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rename = useRenameTenant();
  const [name, setName] = useState(tenant.name);

  // Reopen always starts from the current name, not a stale edit.
  useEffect(() => {
    if (open) setName(tenant.name);
  }, [open, tenant.name]);

  const trimmed = name.trim();
  const canSave =
    trimmed.length >= 2 && trimmed !== tenant.name && !rename.isLoading;

  async function save() {
    if (!canSave) return;
    try {
      await rename.mutateAsync({ tenantId: tenant.tenantId, name: trimmed });
      toast.success("Tenant renamed", {
        description: `The organization is now “${trimmed}”.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't rename the tenant", {
        description: failureMessage(error) ?? undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename tenant</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Label htmlFor="tenant-name">Organization name</Label>
          <Input
            id="tenant-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoFocus
            className="mt-1.5"
          />

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={rename.isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {rename.isLoading ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The locale's language, named in the reader's own language. Only the language
 * subtag is shown — the provisioning locale identifies the language, not a
 * country the record does not otherwise claim.
 */
function localeLabel(locale: string): string {
  const language = locale.split("-")[0] || locale;
  try {
    return (
      new Intl.DisplayNames(undefined, { type: "language" }).of(language) ??
      locale
    );
  } catch {
    return locale;
  }
}
