"use client";

import { Lock } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { Checkbox } from "@repo/ds/components/ui/checkbox";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ds/components/ui/tooltip";
import { cn } from "@repo/ds/lib/utils";
import type { ProvisioningModuleOption } from "./module-catalogue";

const UNAVAILABLE_EXPLANATION = "Not available in this build";

/**
 * The entitlement decision, as a grid of modules rather than a settings list.
 *
 * Every module Fusion has appears here, including the ones this build cannot
 * provision. Hiding them would make the page look complete while quietly
 * misrepresenting the platform; showing them plainly unavailable tells the
 * operator what exists and what they can act on today.
 *
 * Each state is carried by words and structure as well as tint: Core HR reads
 * "Included" with a lock, a chosen module shows a ticked box, and an
 * unavailable one says so in text a screen reader reaches.
 */
export function ModuleGrid({
  options,
  selectedKeys,
  isLoading,
  error,
  onRetry,
  onToggle,
}: {
  options: ProvisioningModuleOption[];
  selectedKeys: string[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onToggle: (key: string, selected: boolean) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[86px] rounded-lg" />
        ))}
      </div>
    );
  }

  // An unread catalogue is not an empty one. Rendering the grid from nothing
  // would show Core HR as unavailable and let the operator commit to
  // entitlements the tenant will not actually have.
  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-5">
        <p className="text-sm text-muted-foreground">
          Module entitlements could not be loaded, so a tenant cannot be
          provisioned yet.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {options.map((option) => (
          <ModuleCard
            key={option.key}
            option={option}
            isSelected={selectedKeys.includes(option.key)}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </TooltipProvider>
  );
}

function ModuleCard({
  option,
  isSelected,
  onToggle,
}: {
  option: ProvisioningModuleOption;
  isSelected: boolean;
  onToggle: (key: string, selected: boolean) => void;
}) {
  const Icon = option.icon;
  const isSelectable = option.availability === "selectable";
  const isUnavailable = option.availability === "unavailable";
  const inputId = `module-${option.key}`;

  return (
    <li
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-3.5 transition-colors",
        isSelectable && "cursor-pointer",
        isSelectable && isSelected
          ? "border-primary bg-primary/[0.05] inset-ring-1 inset-ring-primary/40"
          : "border-border bg-card",
        isSelectable && !isSelected && "hover:border-foreground/25 hover:bg-foreground/[0.03]",
        // Unavailable stays legible rather than greyed into unreadability: the
        // operator still needs to know the module exists.
        isUnavailable && "border-dashed bg-muted/30"
      )}
    >
      {/* The whole card is the target, as a label rather than a click handler.
          A handler on the row looked equivalent but was not: toggling a
          controlled Radix checkbox re-dispatches a click on its hidden input,
          which bubbled straight back into the row and toggled again, forever.
          A label forwards natively and cannot feed itself. */}
      {isSelectable ? (
        <label htmlFor={inputId} className="absolute inset-0 cursor-pointer rounded-lg">
          <span className="sr-only">{option.label}</span>
        </label>
      ) : null}

      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          option.availability === "included"
            ? "bg-primary/15 text-primary"
            : isSelected
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          isUnavailable && "opacity-60"
        )}
      >
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          {isSelectable ? (
            // Plain text, because the stretched label above already names the
            // control; a second label would announce the module twice.
            <span aria-hidden="true" className="text-sm font-medium text-foreground">
              {option.label}
            </span>
          ) : (
            <span
              className={cn(
                "text-sm font-medium",
                isUnavailable ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {option.label}
            </span>
          )}

          <ModuleState
            option={option}
            isSelected={isSelected}
            inputId={inputId}
            onToggle={onToggle}
          />
        </div>

        <p
          className={cn(
            "mt-0.5 text-xs",
            isUnavailable ? "text-muted-foreground/80" : "text-muted-foreground"
          )}
        >
          {option.description}
        </p>
      </div>
    </li>
  );
}

function ModuleState({
  option,
  isSelected,
  inputId,
  onToggle,
}: {
  option: ProvisioningModuleOption;
  isSelected: boolean;
  inputId: string;
  onToggle: (key: string, selected: boolean) => void;
}) {
  if (option.availability === "included") {
    return (
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-primary">
        <Lock aria-hidden="true" className="size-3" />
        Included
      </span>
    );
  }

  if (option.availability === "unavailable") {
    // The status text is itself the tooltip's trigger. Making the whole card
    // focusable would have put a non-actionable stop in the tab order for every
    // unavailable module, and wrapping the row to do it left an element between
    // the list and its items that the list content model does not allow.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${option.label}: ${UNAVAILABLE_EXPLANATION}`}
            // Nothing to activate — it exists to carry the explanation to a
            // pointer and to the keyboard alike.
            onClick={(event) => event.preventDefault()}
            className="shrink-0 cursor-default whitespace-nowrap rounded-sm text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {UNAVAILABLE_EXPLANATION}
          </button>
        </TooltipTrigger>
        <TooltipContent>{UNAVAILABLE_EXPLANATION}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    // Raised above the stretched label so the checkbox still receives its own
    // clicks rather than having them intercepted.
    <span className="relative z-10 flex shrink-0 items-center gap-2">
      <span
        className={cn(
          "whitespace-nowrap text-xs",
          isSelected ? "font-medium text-primary" : "text-muted-foreground"
        )}
      >
        {isSelected ? "Enabled" : "Not enabled"}
      </span>
      <Checkbox
        id={inputId}
        checked={isSelected}
        onCheckedChange={(checked) => onToggle(option.key, checked === true)}
        // Space is the checkbox's own key. Enter is added because the card
        // reads as a single choice, and Enter is what people try on it — left
        // alone it would submit the form instead.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onToggle(option.key, !isSelected);
          }
        }}
      />
    </span>
  );
}

/** Reused by the summary so both describe entitlement the same way. */
export { UNAVAILABLE_EXPLANATION };
