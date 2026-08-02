"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { Checkbox } from "@repo/ds/components/ui/checkbox";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ds/components/ui/popover";
import { Separator } from "@repo/ds/components/ui/separator";
import { cn } from "@repo/ds/lib/utils";
import type {
  DeliveryOutcomeValue,
  InvitationStateValue,
  TenantModule,
} from "../api";
import { DELIVERY_LABEL, INVITATION_LABEL, MODULE_CATALOGUE } from "../language";
import {
  activeFilterCount,
  NO_ADVANCED_FILTERS,
  type AdvancedFilters,
} from "./tenant-query";

/**
 * The narrower conditions, kept behind one control.
 *
 * The four lifecycle cards answer the everyday question; these answer the
 * occasional one, so they stay folded away rather than spending permanent width
 * on controls most sessions never touch. Choices are staged and applied
 * together: changing five conditions should reload the list once, not five
 * times, and the operator should be able to change their mind before committing.
 */

const INVITATION_STATES: InvitationStateValue[] = [
  "Pending",
  "Accepted",
  "Expired",
  "Revoked",
  "Superseded",
];

const DELIVERY_OUTCOMES: DeliveryOutcomeValue[] = ["Sent", "Failed"];

export function TenantFilterPanel({
  filters,
  onApply,
}: {
  filters: AdvancedFilters;
  onApply: (next: AdvancedFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedFilters>(filters);

  // Reopening must show what is actually in force, including a change made
  // elsewhere such as a shared link or the browser's back button.
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const appliedCount = activeFilterCount(filters);
  const draftCount = activeFilterCount(draft);

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((entry) => entry !== value)
      : [...list, value];
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(appliedCount > 0 && "border-primary/50 bg-primary/[0.06]")}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filter
          {appliedCount > 0 ? (
            <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
              {appliedCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="max-h-[26rem] overflow-y-auto p-4">
          <FilterGroup label="Invitation">
            {INVITATION_STATES.map((state) => (
              <FilterCheck
                key={state}
                id={`invitation-${state}`}
                label={INVITATION_LABEL[state]}
                checked={draft.invitationStates.includes(state)}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    invitationStates: toggle(current.invitationStates, state),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <Separator className="my-4" />

          <FilterGroup label="Delivery">
            {DELIVERY_OUTCOMES.map((outcome) => (
              <FilterCheck
                key={outcome}
                id={`delivery-${outcome}`}
                label={DELIVERY_LABEL[outcome]}
                checked={draft.deliveryOutcomes.includes(outcome)}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    deliveryOutcomes: toggle(current.deliveryOutcomes, outcome),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <Separator className="my-4" />

          <FilterGroup label="Modules">
            {MODULE_CATALOGUE.map((module) => (
              <FilterCheck
                key={module.id}
                id={`module-${module.id}`}
                label={module.label}
                checked={draft.modules.includes(module.id)}
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    modules: toggle<TenantModule>(current.modules, module.id),
                  }))
                }
              />
            ))}
          </FilterGroup>

          <Separator className="my-4" />

          <FilterGroup label="Created">
            <div className="grid grid-cols-2 gap-2">
              <DateField
                id="created-from"
                label="From"
                value={draft.createdFrom}
                max={draft.createdTo ?? undefined}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, createdFrom: value }))
                }
              />
              <DateField
                id="created-to"
                label="To"
                value={draft.createdTo}
                min={draft.createdFrom ?? undefined}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, createdTo: value }))
                }
              />
            </div>
          </FilterGroup>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            // Clearing is meaningless with nothing set, and an enabled control
            // that does nothing is worse than a disabled one.
            disabled={draftCount === 0}
            onClick={() => setDraft(NO_ADVANCED_FILTERS)}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function FilterCheck({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  min?: string;
  max?: string;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </div>
  );
}
