"use client";

import { useMemo, type ComponentType, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  LayoutGrid,
  Pencil,
  User,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { useProvisionableModules } from "../../queries";
import {
  buildModuleOptions,
  type ProvisioningModuleOption,
} from "../module-catalogue";
import { adminRoleByValue } from "../admin-role-options";
import {
  PLATFORM_DEFAULT_LOCALE,
  labelForLocale,
  labelForTimeZone,
  timeZoneOffset,
} from "../provisioning-options";
import { COUNTRY_OPTIONS } from "../regional-presentation-options";
import { SubmissionFailure } from "../step-navigation";
import type { ProvisioningStepProps } from "./types";

/** Step indices the Edit links jump back to, mirroring PROVISIONING_STEPS. */
const ORGANIZATION_STEP = 0;
const REGION_STEP = 1;
const ADMIN_STEP = 2;

type ReviewStepProps = ProvisioningStepProps & {
  /** Jumps back to a step so a summarised value can be corrected in place. */
  onEditStep?: (step: number) => void;
  /** Commits the tenant — the wizard's terminal action lives in this panel. */
  onProvision?: () => void;
  /** Whether the draft is valid and the catalogue is loaded. */
  canProvision?: boolean;
  provisionPending?: boolean;
  provisionFailure?: Error | null;
};

/**
 * The last surface before the tenant is created. The left column restates every
 * decision, each card able to send the operator back to the step that owns it;
 * the right column is where the commitment is made, naming what provisioning
 * will do before it does it. Nothing here is editable in place — a summary that
 * could be edited would be a fourth copy of three forms — so correction is a
 * jump back, not an inline field.
 */
export function ReviewStep({
  draft,
  onEditStep,
  onProvision,
  canProvision = false,
  provisionPending = false,
  provisionFailure = null,
}: ReviewStepProps) {
  const catalogue = useProvisionableModules();
  const options = useMemo(
    () => buildModuleOptions(catalogue.data ?? []),
    [catalogue.data]
  );

  const included = useMemo(
    () => options.filter((option) => option.availability === "included"),
    [options]
  );
  const selected = useMemo(
    () =>
      options.filter(
        (option) =>
          option.availability === "selectable" &&
          draft.selectedModuleKeys.includes(option.key)
      ),
    [options, draft.selectedModuleKeys]
  );

  const offset = useMemo(
    () => timeZoneOffset(draft.timeZone),
    [draft.timeZone]
  );
  const role = adminRoleByValue(draft.adminRole);
  const countryLabel = useMemo(
    () =>
      COUNTRY_OPTIONS.find((option) => option.value === draft.country)?.label ??
      draft.country,
    [draft.country]
  );

  const languageLabel =
    draft.locale === PLATFORM_DEFAULT_LOCALE
      ? "Platform default"
      : labelForLocale(draft.locale);
  const timeZoneLabel = `${labelForTimeZone(draft.timeZone)} (${offset})`;

  const adminName = [draft.firstName.trim(), draft.lastName.trim()]
    .filter(Boolean)
    .join(" ");
  const enabledProducts = [...included, ...selected];
  const enabledKeys = new Set(enabledProducts.map((option) => option.key));
  const restProducts = options.filter((option) => !enabledKeys.has(option.key));

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-3">
        <SummaryCard
          icon={Building2}
          title="Organization details"
          onEdit={onEditStep ? () => onEditStep(ORGANIZATION_STEP) : undefined}
        >
          <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:flex justify-between">
            <Fact label="Tenant name" value={draft.name} />
            <Fact label="Tenant slug" value={draft.tenantSlug} />
            <Fact label="Legal entity" value={draft.legalEntityName} />
            <Fact
              label="Internal reference"
              value={draft.internalReferenceCode}
            />
          </dl>
          {/* <dl className="mt-4">
            <Fact label="Short description" value={draft.shortDescription} />
          </dl> */}
        </SummaryCard>

        <SummaryCard
          icon={Globe}
          title="Region and defaults"
          onEdit={onEditStep ? () => onEditStep(REGION_STEP) : undefined}
        >
          <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:flex justify-between">
            <Fact label="Country / region" value={countryLabel} />
            <Fact label="Time zone" value={timeZoneLabel} />
            <Fact label="Default language" value={languageLabel} />
            <Fact label="Date format" value={draft.dateFormat} />
          </dl>
        </SummaryCard>

        <SummaryCard
          icon={BarChart3}
          title="Product entitlements"
          onEdit={onEditStep ? () => onEditStep(REGION_STEP) : undefined}
        >
          {catalogue.data ? (
            <div className="space-y-3">
              {/* What the tenant gets reads first, along one row; what it does
                  not sits together below, quiet. */}
              {enabledProducts.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {enabledProducts.map((option) => (
                    <ProductChip
                      key={option.key}
                      option={option}
                      selected
                      className="min-w-[10rem] flex-1"
                    />
                  ))}
                </div>
              ) : null}
              {restProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {restProducts.map((option) => (
                    <ProductChip
                      key={option.key}
                      option={option}
                      selected={false}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Product entitlements are still loading.
            </p>
          )}
        </SummaryCard>

        <SummaryCard
          icon={User}
          title="Initial administrator"
          onEdit={onEditStep ? () => onEditStep(ADMIN_STEP) : undefined}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Fact label="Name" value={adminName} />
            <Fact label="Work email" value={draft.administratorEmail} />
            <Fact label="Role" value={role.label} />
            <Fact
              label="Invitation"
              value={draft.sendInvitation ? "Send immediately" : "Send later"}
            />
          </dl>
        </SummaryCard>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {canProvision ? (
                <CheckCircle2 aria-hidden="true" className="size-5" />
              ) : (
                <AlertCircle aria-hidden="true" className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <h3 className="type-subsection-title text-foreground">
                {canProvision ? "Ready to provision" : "Almost ready"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {canProvision
                  ? "Everything looks good. Review the details and create the tenant."
                  : "Complete the required details before the tenant can be created."}
              </p>
            </div>
          </div>

          <div className="border-t border-border" />

          <div>
            <p className="type-eyebrow mb-3 text-muted-foreground">
              What will happen?
            </p>
            <ul className="space-y-2.5">
              {[
                "Create tenant workspace",
                "Apply regional defaults",
                "Enable selected products",
                "Create initial administrator",
                draft.sendInvitation
                  ? "Send invitation email"
                  : "Prepare invitation to send later",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm">
                  <Check
                    aria-hidden="true"
                    className="size-4 shrink-0 text-success"
                  />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border" />

          <div>
            <p className="type-eyebrow mb-3 text-muted-foreground">Summary</p>
            <div className="space-y-2.5">
              <SummaryTile
                icon={LayoutGrid}
                title={`${enabledProducts.length} enabled ${
                  enabledProducts.length === 1 ? "product" : "products"
                }`}
                detail={enabledProducts
                  .map((option) => option.label)
                  .join(", ")}
              />
              <SummaryTile
                icon={Globe}
                title={`Region: ${countryLabel}`}
                detail={timeZoneLabel}
              />
              <SummaryTile
                icon={User}
                title="1 administrator"
                detail={
                  adminName || draft.administratorEmail.trim() || "Not set"
                }
              />
            </div>
          </div>

          {provisionFailure ? (
            <SubmissionFailure error={provisionFailure} />
          ) : null}

          <div>
            <AsyncButton
              type="button"
              size="lg"
              className="w-full"
              onClick={onProvision}
              disabled={!canProvision}
              pending={provisionPending}
            >
              Provision tenant
              <ArrowRight aria-hidden="true" className="size-4" />
            </AsyncButton>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              You can manage products and tenant settings later.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** A summarised section with the icon, title, and jump-back Edit of its step. */
function SummaryCard({
  icon: Icon,
  title,
  onEdit,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon aria-hidden={true} className="size-5" />
          </span>
          <h3 className="type-section-title text-foreground">{title}</h3>
        </div>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mr-2 shrink-0 text-muted-foreground"
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            Edit
          </Button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** One summarised value: a quiet label over the value the operator entered. */
function Fact({ label, value }: { label: string; value: string }) {
  const isEmpty = value.trim().length === 0;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm [overflow-wrap:anywhere]",
          isEmpty
            ? "italic text-muted-foreground"
            : "font-medium text-foreground"
        )}
      >
        {isEmpty ? "Not set" : value}
      </dd>
    </div>
  );
}

/** A compact recap line in the commit panel: an icon, a headline, its detail. */
function SummaryTile({
  icon: Icon,
  title,
  detail,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden={true} className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {detail || "—"}
        </p>
      </div>
    </div>
  );
}

/**
 * A product as it stands in the summary: the foundation and each enabled product
 * carry their colour, while anything off or unavailable recedes — the same
 * grammar as the products step, without a switch to throw.
 */
function ProductChip({
  option,
  selected,
  className,
}: {
  option: ProvisioningModuleOption;
  selected: boolean;
  className?: string;
}) {
  const Icon = option.icon;
  const included = option.availability === "included";
  const enabled = option.availability === "selectable" && selected;

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        included
          ? "border-primary/60 bg-primary/[0.06]"
          : enabled
            ? "border-success/50 bg-success/10"
            : "border-border opacity-60",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0",
            included
              ? "text-primary"
              : enabled
                ? "text-success"
                : "text-muted-foreground"
          )}
        />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {option.label}
        </span>
        {included ? (
          <span className=" inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            Required
          </span>
        ) : enabled ? (
          <span className="inline-block rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            Enabled
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {option.description}
      </p>
    </div>
  );
}
