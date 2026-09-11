"use client";

import { useMemo } from "react";
import { Info, Lock } from "lucide-react";
import { Switch } from "@repo/ds/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ds/components/ui/tooltip";
import { cn } from "@repo/ds/lib/utils";
import { Field } from "../field";
import { useProvisionableModules } from "../../queries";
import {
  buildModuleOptions,
  type ProvisioningModuleOption,
} from "../module-catalogue";
import { LOCALE_OPTIONS, timeZoneOptions } from "../provisioning-options";
import {
  COUNTRY_OPTIONS,
  DATE_FORMAT_OPTIONS,
} from "../regional-presentation-options";
import { SearchableSelect } from "../searchable-select";
import { StepPanel } from "./step-panel";
import type { ProvisioningStepProps } from "./types";

/**
 * Where the tenant operates and what it may use, as two decisions side by side:
 * the presentation defaults that shape how it reads, and the Fusion products it
 * is entitled to. Core HR is not a choice — it is the foundation every tenant
 * gets — so it is stated, while the rest are switched on or off.
 */
export function RegionProductsStep({
  draft,
  update,
  validateField,
  toggleModule,
}: ProvisioningStepProps) {
  const catalogue = useProvisionableModules();
  const options = useMemo(
    () => buildModuleOptions(catalogue.data ?? []),
    [catalogue.data]
  );

  // Several hundred zones whose offsets do not move while the form is open, so
  // the list is built once rather than on every keystroke.
  const zoneOptions = useMemo(
    () =>
      timeZoneOptions().map((zone) => ({
        value: zone.value,
        label: zone.label,
        detail: zone.offset,
        keywords: zone.keywords,
        group: zone.region,
      })),
    []
  );

  const localeOptions = useMemo(
    () =>
      LOCALE_OPTIONS.map((locale) => ({
        value: locale.value,
        label: locale.label,
        detail: locale.value || undefined,
        keywords: `${locale.keywords} ${locale.value}`,
      })),
    []
  );

  return (
    // The settings column is the narrower of the two, giving the products room
    // to sit in a grid; both panels stretch to a common height so their bottoms
    // align.
    <div className="grid items-stretch gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <StepPanel
        title="Region and default settings"
        description="These settings define the tenant's defaults."
        className="h-full"
      >
        <div className="space-y-5">
          <Field id="tenant-country" label="Country / region">
            <SearchableSelect
              id="tenant-country"
              options={COUNTRY_OPTIONS}
              value={draft.country}
              placeholder="Select a country"
              searchPlaceholder="Search country or region"
              emptyMessage="No country matches."
              onChange={(value) => update("country", value)}
            />
          </Field>

          <Field
            id="tenant-time-zone"
            label="Time zone"
            required
            error={undefined}
          >
            <SearchableSelect
              id="tenant-time-zone"
              options={zoneOptions}
              value={draft.timeZone}
              placeholder="Select a time zone"
              searchPlaceholder="Search city, region or offset"
              emptyMessage="No time zone matches."
              onChange={(value) => update("timeZone", value)}
              onBlur={() => validateField("timeZone")}
            />
          </Field>

          <Field id="tenant-locale" label="Default language">
            <SearchableSelect
              id="tenant-locale"
              options={localeOptions}
              value={draft.locale}
              placeholder="Select a language"
              searchPlaceholder="Search language, country or code"
              emptyMessage="No language matches."
              onChange={(value) => update("locale", value)}
            />
          </Field>

          <Field id="tenant-date-format" label="Date format">
            <SearchableSelect
              id="tenant-date-format"
              options={DATE_FORMAT_OPTIONS}
              value={draft.dateFormat}
              placeholder="Select a date format"
              searchPlaceholder="Search date format"
              emptyMessage="No format matches."
              onChange={(value) => update("dateFormat", value)}
            />
          </Field>
        </div>
      </StepPanel>

      <StepPanel
        title="Product entitlements"
        description="Select the Fusion products to enable for this tenant."
        className="h-full"
        action={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                type="button"
                aria-label="About product entitlements"
                className="flex size-7 items-center justify-center rounded-full text-primary transition-colors hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Info aria-hidden="true" className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="left">
                Core HR is included with every tenant. Products marked
                unavailable aren&rsquo;t offered in this build yet.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) =>
            option.availability === "included" ? (
              <IncludedModuleCard key={option.key} option={option} />
            ) : (
              <ModuleToggleRow
                key={option.key}
                option={option}
                selected={draft.selectedModuleKeys.includes(option.key)}
                onToggle={(next) => toggleModule(option.key, next)}
              />
            )
          )}
        </div>
      </StepPanel>
    </div>
  );
}

/**
 * The foundation module. It sits in the grid like the others so the products
 * read as one set, but it is never a choice: the amber surface, the Required
 * badge, and the locked-on state where a switch would be all say it is always
 * part of the tenant.
 */
function IncludedModuleCard({ option }: { option: ProvisioningModuleOption }) {
  const Icon = option.icon;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/60 bg-primary/[0.06] p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="type-subsection-title text-foreground">
            {option.label}
          </h3>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            Required
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {option.description}
        </p>
      </div>

      <Lock
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
    </div>
  );
}

/**
 * An optional product, switched on or off. A product this build does not offer
 * is shown but cannot be enabled, so the switch is disabled and says why —
 * hiding it would leave the operator wondering where a product went.
 */
function ModuleToggleRow({
  option,
  selected,
  onToggle,
}: {
  option: ProvisioningModuleOption;
  selected: boolean;
  onToggle: (next: boolean) => void;
}) {
  const Icon = option.icon;
  const available = option.availability === "selectable";
  // An enabled product carries the same amber treatment as the included one, so
  // "on" reads the same everywhere on the panel.
  const active = available && selected;

  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 transition-colors",
        active
          ? "border-primary/60 bg-primary/[0.06]"
          : available
            ? "cursor-pointer border-border bg-muted/30 hover:bg-muted/50"
            : "cursor-not-allowed border-border opacity-60"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          active
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="type-subsection-title text-foreground">
          {option.label}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {option.description}
        </p>
      </div>

      <Switch
        checked={available ? selected : false}
        onCheckedChange={available ? onToggle : undefined}
        disabled={!available}
        aria-label={
          available ? `Enable ${option.label}` : `${option.label} unavailable`
        }
        className="mt-0.5"
      />
    </label>
  );
}
