"use client";

import { useState } from "react";
import { Check, ChevronRight, Minus, Users } from "lucide-react";
import type { WorkforceOrgUnitTreeNodeDto } from "@repo/api";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { initials } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { campaignPopulation } from "./campaign-terminology";

/** orgUnitId → includeDescendants. Presence means the unit is explicitly included. */
export type ScopeSelection = Map<string, boolean>;

export type UnitMember = {
  employeeId: string;
  fullName: string;
  jobTitle: string | null;
  order: number;
};

export type ExcludedPerson = {
  employeeId: string;
  name: string;
  reason: string;
};

/** Everything the tree needs to render and mutate the people inside its units. */
export type PeopleApi = {
  membersByUnit: Map<string, UnitMember[]>;
  excludedByUnit: Map<string, ExcludedPerson[]>;
  unplacedExclusions: ExcludedPerson[];
  excludedIds: Set<string>;
  onExclude: (employeeId: string, orgUnitId: string, name: string) => void;
  onReinclude: (employeeId: string) => void;
  onReason: (employeeId: string, reason: string) => void;
};

const PERSON_CAP = 50;

/**
 * Client-side estimate of the resolved headcount: the sum of the maximal included
 * subtrees, minus explicit exclusions. It reconciles to the authoritative server
 * count after autosave, but lets the number move the instant something is toggled.
 */
export function estimateReach(
  roots: WorkforceOrgUnitTreeNodeDto[],
  scopeById: ScopeSelection,
  exclusionCount: number
): number {
  let total = 0;
  const walk = (
    node: WorkforceOrgUnitTreeNodeDto,
    coveredByAncestor: boolean
  ) => {
    const descendants = scopeById.get(node.id);
    const included = descendants !== undefined;
    if (included && !coveredByAncestor) {
      total += descendants ? node.totalMemberCount : node.memberCount;
    }
    const nowCovered = coveredByAncestor || (included && descendants === true);
    for (const child of node.children) walk(child, nowCovered);
  };
  for (const root of roots) walk(root, false);
  return Math.max(0, total - exclusionCount);
}

export function totalWorkforce(roots: WorkforceOrgUnitTreeNodeDto[]): number {
  return roots.reduce((sum, root) => sum + root.totalMemberCount, 0);
}

function ancestorsOfInterest(
  roots: WorkforceOrgUnitTreeNodeDto[],
  scopeById: ScopeSelection,
  people: PeopleApi
): Set<string> {
  const expand = new Set<string>();
  const walk = (
    node: WorkforceOrgUnitTreeNodeDto,
    ancestors: string[]
  ): boolean => {
    let interesting =
      scopeById.has(node.id) ||
      (people.excludedByUnit.get(node.id)?.length ?? 0) > 0;
    for (const child of node.children) {
      if (walk(child, [...ancestors, node.id])) interesting = true;
    }
    if (interesting) for (const id of ancestors) expand.add(id);
    return interesting;
  };
  for (const root of roots) walk(root, []);
  return expand;
}

/**
 * The population as the real org tree. Units include people (checkbox paints the
 * branch); expanding a unit reveals the people it resolves to, each of which can
 * be deselected on the spot to exclude them. Include and exclude, one surface.
 */
export function PopulationScopeTree({
  roots,
  scopeById,
  readOnly,
  people,
  onInclude,
  onRemove,
  onToggleDescendants,
}: {
  roots: WorkforceOrgUnitTreeNodeDto[];
  scopeById: ScopeSelection;
  readOnly: boolean;
  people: PeopleApi;
  onInclude: (orgUnitId: string) => void;
  onRemove: (orgUnitId: string) => void;
  onToggleDescendants: (orgUnitId: string, includeDescendants: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = ancestorsOfInterest(roots, scopeById, people);
    for (const root of roots) init.add(root.id);
    return init;
  });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (roots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        {campaignPopulation.treeEmpty}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="max-h-[30rem] overflow-y-auto">
        {roots.map((root) => (
          <ScopeTreeRow
            key={root.id}
            node={root}
            depth={0}
            inheritedFrom={null}
            scopeById={scopeById}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            readOnly={readOnly}
            people={people}
            onInclude={onInclude}
            onRemove={onRemove}
            onToggleDescendants={onToggleDescendants}
          />
        ))}
        {people.unplacedExclusions.length > 0 ? (
          <div className="border-t border-border bg-muted/20">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {campaignPopulation.excludedElsewhere}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {people.unplacedExclusions.length.toLocaleString()}
              </span>
            </div>
            {people.unplacedExclusions.map((person) => (
              <PersonRow
                key={person.employeeId}
                depth={0}
                name={person.name}
                caption={null}
                excluded
                reason={person.reason}
                readOnly={readOnly}
                onToggle={() => people.onReinclude(person.employeeId)}
                onReason={(reason) =>
                  people.onReason(person.employeeId, reason)
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScopeTreeRow({
  node,
  depth,
  inheritedFrom,
  scopeById,
  expanded,
  onToggleExpand,
  readOnly,
  people,
  onInclude,
  onRemove,
  onToggleDescendants,
}: {
  node: WorkforceOrgUnitTreeNodeDto;
  depth: number;
  inheritedFrom: string | null;
  scopeById: ScopeSelection;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  readOnly: boolean;
  people: PeopleApi;
  onInclude: (orgUnitId: string) => void;
  onRemove: (orgUnitId: string) => void;
  onToggleDescendants: (orgUnitId: string, includeDescendants: boolean) => void;
}) {
  const descendants = scopeById.get(node.id);
  const explicit = descendants !== undefined;
  const state: "explicit" | "inherited" | "none" = explicit
    ? "explicit"
    : inheritedFrom
      ? "inherited"
      : "none";
  const covered = state !== "none";

  const members = people.membersByUnit.get(node.id) ?? [];
  const excludedHere = people.excludedByUnit.get(node.id) ?? [];
  const excludedById = new Map(
    excludedHere.map((person) => [person.employeeId, person])
  );
  const renderedMemberIds = new Set(members.map((member) => member.employeeId));
  const peopleCount =
    members.length +
    excludedHere.filter((person) => !renderedMemberIds.has(person.employeeId))
      .length;

  const hasChildren = node.children.length > 0;
  const hasContent = hasChildren || peopleCount > 0;
  const isOpen = expanded.has(node.id);
  const childInheritedFrom =
    explicit && descendants === true ? node.name : inheritedFrom;
  const showsDescendantsToggle = state === "explicit" && hasChildren;

  const shownMembers = members.slice(0, PERSON_CAP);
  const hiddenMembers = members.length - shownMembers.length;

  return (
    <>
      <div
        className={cn(
          "border-b border-border/60 px-3 py-2 transition-colors",
          covered ? "bg-primary/[0.05]" : "hover:bg-muted/40"
        )}
        style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
      >
        <div className="flex items-center gap-2">
          {hasContent ? (
            <button
              type="button"
              onClick={() => onToggleExpand(node.id)}
              aria-label={isOpen ? "Collapse" : "Expand"}
              aria-expanded={isOpen}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  isOpen && "rotate-90"
                )}
              />
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden />
          )}

          <IncludeControl
            state={state}
            disabled={readOnly}
            label={
              explicit
                ? campaignPopulation.removeUnit(node.name)
                : campaignPopulation.includeUnit(node.name)
            }
            onClick={() => (explicit ? onRemove(node.id) : onInclude(node.id))}
          />

          <span className="min-w-0 flex-1 truncate">
            <span
              className={cn(
                "text-sm font-medium",
                covered ? "text-foreground" : "text-foreground/90"
              )}
            >
              {node.name}
            </span>
            {state === "inherited" && inheritedFrom ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {campaignPopulation.viaAncestor(inheritedFrom)}
              </span>
            ) : null}
          </span>

          {showsDescendantsToggle ? (
            <DescendantsToggle
              className="hidden sm:flex"
              checked={descendants === true}
              disabled={readOnly}
              name={node.name}
              onCheckedChange={(checked) =>
                onToggleDescendants(node.id, checked)
              }
            />
          ) : null}

          <Headcount count={node.totalMemberCount} className="hidden sm:flex" />
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 pl-12 sm:hidden">
          {showsDescendantsToggle ? (
            <DescendantsToggle
              checked={descendants === true}
              disabled={readOnly}
              name={node.name}
              onCheckedChange={(checked) =>
                onToggleDescendants(node.id, checked)
              }
            />
          ) : (
            <span aria-hidden />
          )}
          <Headcount count={node.totalMemberCount} />
        </div>
      </div>

      {isOpen ? (
        <>
          {hasChildren
            ? node.children.map((child) => (
                <ScopeTreeRow
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  inheritedFrom={childInheritedFrom}
                  scopeById={scopeById}
                  expanded={expanded}
                  onToggleExpand={onToggleExpand}
                  readOnly={readOnly}
                  people={people}
                  onInclude={onInclude}
                  onRemove={onRemove}
                  onToggleDescendants={onToggleDescendants}
                />
              ))
            : null}

          {shownMembers.map((member) => (
            <PersonRow
              key={member.employeeId}
              depth={depth + 1}
              name={
                excludedById.get(member.employeeId)?.name ?? member.fullName
              }
              caption={member.jobTitle}
              excluded={people.excludedIds.has(member.employeeId)}
              reason={excludedById.get(member.employeeId)?.reason ?? ""}
              readOnly={readOnly}
              onToggle={() =>
                people.excludedIds.has(member.employeeId)
                  ? people.onReinclude(member.employeeId)
                  : people.onExclude(
                      member.employeeId,
                      node.id,
                      member.fullName
                    )
              }
              onReason={(reason) => people.onReason(member.employeeId, reason)}
            />
          ))}

          {excludedHere
            .filter((person) => !renderedMemberIds.has(person.employeeId))
            .map((person) => (
              <PersonRow
                key={person.employeeId}
                depth={depth + 1}
                name={person.name}
                caption={null}
                excluded
                reason={person.reason}
                readOnly={readOnly}
                onToggle={() => people.onReinclude(person.employeeId)}
                onReason={(reason) =>
                  people.onReason(person.employeeId, reason)
                }
              />
            ))}

          {hiddenMembers > 0 ? (
            <p
              className="border-b border-border/60 py-1.5 text-xs text-muted-foreground"
              style={{ paddingLeft: `${0.5 + (depth + 1) * 1.25 + 1.75}rem` }}
            >
              {campaignPopulation.morePeople(hiddenMembers)}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function DescendantsToggle({
  checked,
  disabled,
  name,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  disabled: boolean;
  name: string;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "shrink-0 select-none items-center gap-1.5 text-xs text-muted-foreground",
        className ?? "flex"
      )}
    >
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={`${campaignPopulation.subUnits} · ${name}`}
      />
      {campaignPopulation.subUnits}
    </label>
  );
}

function Headcount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-end gap-1 text-xs tabular-nums text-muted-foreground sm:w-14",
        className
      )}
    >
      <Users className="size-3.5" />
      {count.toLocaleString()}
    </span>
  );
}

function PersonRow({
  depth,
  name,
  caption,
  excluded,
  reason,
  readOnly,
  onToggle,
  onReason,
}: {
  depth: number;
  name: string;
  caption: string | null;
  excluded: boolean;
  reason: string;
  readOnly: boolean;
  onToggle: () => void;
  onReason: (reason: string) => void;
}) {
  const missingReason = excluded && !reason.trim();
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border/60 py-1.5 pr-3 transition-colors",
        excluded ? "bg-destructive/[0.03]" : "hover:bg-muted/30"
      )}
      style={{ paddingLeft: `${0.5 + depth * 1.25 + 1.75}rem` }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={readOnly}
        aria-pressed={!excluded}
        aria-label={
          excluded
            ? campaignPopulation.reincludePerson(name)
            : campaignPopulation.excludePerson(name)
        }
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          excluded
            ? "border-muted-foreground/40 text-muted-foreground hover:border-primary/50"
            : "border-primary bg-primary text-primary-foreground"
        )}
      >
        {excluded ? (
          <Minus className="size-3" />
        ) : (
          <Check className="size-3.5" />
        )}
      </button>

      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-muted-foreground">
        {initials(name)}
      </span>

      <span className="min-w-0 flex-1 truncate">
        <span
          className={cn(
            "text-sm",
            excluded
              ? "text-muted-foreground line-through"
              : "font-medium text-foreground"
          )}
        >
          {name}
        </span>
        {caption && !excluded ? (
          <span className="ml-2 text-xs text-muted-foreground">{caption}</span>
        ) : null}
      </span>

      {excluded ? (
        <Input
          value={reason}
          disabled={readOnly}
          placeholder={campaignPopulation.addReason}
          aria-label={campaignPopulation.exclusionReasonLabel}
          aria-invalid={missingReason}
          className={cn(
            "h-7 w-40 shrink-0",
            missingReason && "border-destructive"
          )}
          onChange={(event) => onReason(event.target.value)}
        />
      ) : null}
    </div>
  );
}

function IncludeControl({
  state,
  disabled,
  label,
  onClick,
}: {
  state: "explicit" | "inherited" | "none";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "inherited"}
      aria-label={label}
      aria-pressed={state !== "none"}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        state === "explicit"
          ? "border-primary bg-primary text-primary-foreground"
          : state === "inherited"
            ? "border-primary/30 bg-primary/15 text-primary"
            : "border-muted-foreground/40 text-transparent hover:border-primary/50"
      )}
    >
      {state !== "none" ? <Check className="size-3.5" /> : null}
    </button>
  );
}
