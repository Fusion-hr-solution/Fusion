"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Gauge,
  Layers,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import type { GoalNodeDto, GoalsOverviewDto } from "@repo/api";
import { ScopeMark } from "../scope-mark";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { cn } from "@repo/ds/lib/utils";
import { useGoal } from "../../api/use-performance";
import { buildGoalGraph, initials, STATE_LABEL, STATE_TONE } from "./goals-lib";
import {
  resolveWorkspace,
  rootOrgLabel,
  type ObjectiveBlock,
  type UnitContext,
} from "./working-context-lib";

/**
 * The single Organization Goals workspace. One grammar serves every actor — administration lands
 * organization-wide, a workforce leader lands on their own unit — and both drill the same objective
 * hierarchy. The dominant upstream object is always the **direct parent** of the objective in view
 * (company strategic OR another organizational objective); higher strategy stays as quiet lineage.
 * No health, no fabricated progress, no org-chart placeholders — only real objective alignment.
 */
export function ObjectiveWorkspace({
  cycleId,
  overview,
  focusId,
  ownUnit,
  broad,
  canAuthor,
  canReachSetup,
  onFocus,
  onInspect,
  onCreate,
  onResumeDraft,
}: {
  cycleId: string;
  overview: GoalsOverviewDto;
  /** The drilled-into objective, or null for the actor's default context. */
  focusId: string | null;
  /** The actor's own organizational placement, or null (administration / no placement). */
  ownUnit: UnitContext | null;
  /** Whether the default context is organization-wide (authority, not placement). */
  broad: boolean;
  canAuthor: boolean;
  canReachSetup: boolean;
  onFocus: (objectiveId: string | null) => void;
  onInspect: (objectiveId: string) => void;
  /** Contextual create under a resolved parent, in the given organizational scope. */
  onCreate: (parentObjectiveId: string, orgUnitId: string | null) => void;
  onResumeDraft: (objectiveId: string) => void;
}) {
  const composition = useMemo(
    () => resolveWorkspace(overview.nodes, { focusId, ownUnit, broad }),
    [overview.nodes, focusId, ownUnit, broad],
  );

  // The parent→children index, so the aligned-objectives tree can recurse into deeper generations
  // inline (children of children) rather than hiding them behind a drill.
  const childrenByParent = useMemo(() => buildGoalGraph(overview.nodes).childrenByParent, [overview.nodes]);

  // The brand/root name for attributing a company strategic objective, when the actor's own path
  // exposes it. Absent for administration/focus — the label falls back to the generic form.
  const orgName = rootOrgLabel(ownUnit?.path);

  if (composition.kind === "organization") {
    return (
      <div className="space-y-8">
        <OrgWideHeader />
        <div className="space-y-12">
          {composition.blocks.length === 0 ? (
            <NoPublishedDirection canReachSetup={canReachSetup} />
          ) : (
            composition.blocks.map((block) => (
              // Organization-wide uses the same block grammar as every other context — a strategic
              // root is simply a subject with nothing above it. Neutral emphasis (no personal "your
              // objective" glow) because administration has no personal scope.
              <ObjectiveBlockView
                key={block.node.id}
                cycleId={cycleId}
                block={block}
                childrenByParent={childrenByParent}
                orgName={orgName}
                subjectEyebrow={companyEyebrow(orgName)}
                emphasis="focused"
                onInspect={onInspect}
                onResumeDraft={onResumeDraft}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  if (composition.kind === "focused") {
    return (
      <div className="space-y-6">
        <FocusTrail block={composition.block} onFocus={onFocus} />
        <ContextHeader
          eyebrow={neutralEyebrow(composition.unit.scope)}
          title={composition.unit.name}
        />
        <ObjectiveBlockView
          cycleId={cycleId}
          block={composition.block}
          childrenByParent={childrenByParent}
          orgName={orgName}
          subjectEyebrow="Focused objective"
          emphasis="focused"
          onInspect={onInspect}
          onResumeDraft={onResumeDraft}
        />
      </div>
    );
  }

  // Own-unit context (established or empty).
  return (
    <div className="space-y-8">
      <ContextHeader
        eyebrow={belongingLabel(composition.unit.type)}
        title={composition.unit.name}
        memberCount={composition.unit.memberCount ?? null}
        switcherName={composition.unit.name}
      />

      {composition.kind === "unit" ? (
        <div className="space-y-12">
          {composition.blocks.map((block) => (
            <ObjectiveBlockView
              key={block.node.id}
              cycleId={cycleId}
              block={block}
              childrenByParent={childrenByParent}
              orgName={orgName}
              subjectEyebrow={`${composition.unit.name} objective`}
              emphasis="own"
              onInspect={onInspect}
              onResumeDraft={onResumeDraft}
            />
          ))}
        </div>
      ) : !composition.hasPublishedDirection ? (
        <NoPublishedDirection canReachSetup={canReachSetup} />
      ) : (
        <EmptyUnitContext
          cycleId={cycleId}
          unit={composition.unit}
          candidates={composition.candidates}
          orgName={orgName}
          canAuthor={canAuthor}
          onInspect={onInspect}
          onCreate={onCreate}
        />
      )}
    </div>
  );
}

// ── Context header ──────────────────────────────────────────────────────────────

/**
 * The band naming the current working context. A possessive framing ("Your team · Talent Pod") is
 * used only for the actor's own placement — proven by a `memberCount`/`switcherName` being passed;
 * every other context (organization-wide, a drilled unit) is named neutrally, never faking a
 * personal unit for an administrator.
 */
function ContextHeader({
  eyebrow,
  title,
  memberCount,
  switcherName,
}: {
  eyebrow: string;
  title: string;
  memberCount?: number | null;
  switcherName?: string;
}) {
  const own = switcherName != null;
  return (
    <section className="flex items-center gap-4 rounded-2xl border border-border bg-muted/30 p-4 sm:px-5">
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary"
      >
        {own ? initials(title) : <Building2 className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-eyebrow text-muted-foreground">{eyebrow}</p>
        <div className="mt-1 flex items-center gap-2.5">
          <h2 className="truncate text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          {memberCount != null ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5 text-muted-foreground/70" aria-hidden />
              <span className="tabular-nums">{memberCount}</span> directly assigned
            </span>
          ) : null}
        </div>
      </div>
      {switcherName ? <ScopeSwitcher name={switcherName} /> : null}
    </section>
  );
}

/**
 * The organization-wide context marker for administration. Deliberately lighter than the unit band —
 * it carries little information (no headcount, no scope, no possessive), so it is a slim label rather
 * than a full card, keeping the strategic roots below as the page's real weight.
 */
function OrgWideHeader() {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
      >
        <Building2 className="size-4" />
      </span>
      <div>
        <p className="type-eyebrow text-muted-foreground">Organization</p>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Organization-wide</h2>
      </div>
    </div>
  );
}

/** "Your team" / "Your department" / … from the unit type, falling back to "Your organization". */
function belongingLabel(type: string | null | undefined): string {
  const t = type?.trim();
  return t ? `Your ${t.toLowerCase()}` : "Your organization";
}

/** A neutral, non-possessive eyebrow for a context the actor does not personally own. */
function neutralEyebrow(scope: GoalNodeDto["ownershipScope"]): string {
  if (scope === "OrgUnit") return "Organizational unit";
  if (scope === "Employee") return "Individual";
  return "Organization";
}

/**
 * Scope control. Multi-scope responsibility isn't modeled in the MVP, so this presents the actor's
 * single organizational context as a switchable control (one option, current) rather than a dead
 * label — the shape the product grows into once a leader owns more than one scope.
 */
function ScopeSwitcher({ name }: { name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto shrink-0 self-center">
          <Building2 className="size-3.5" data-icon="inline-start" aria-hidden />
          <span className="max-w-[10rem] truncate">{name}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" data-icon="inline-end" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Organizational scope</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-between">
          <span className="truncate">{name}</span>
          <Check className="size-4 text-primary" aria-hidden />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The eyebrow attributing a company strategic objective, using the org's own name when known. */
function companyEyebrow(orgName: string | null): string {
  return orgName ? `${orgName} strategic objective` : "Company strategic objective";
}

// ── A subject objective with its upstream direction and downstream cascade ──────────

/**
 * The workspace's repeating unit: the direct-parent direction (prominent), the subject objective,
 * and its aligned children. When the subject is a strategic root it needs no upstream; otherwise the
 * real immediate parent leads and higher ancestors stay quiet.
 */
function ObjectiveBlockView({
  cycleId,
  block,
  childrenByParent,
  orgName,
  subjectEyebrow,
  emphasis,
  onInspect,
  onResumeDraft,
}: {
  cycleId: string;
  block: ObjectiveBlock;
  /** Parent→children index, for rendering deeper generations inline. */
  childrenByParent: Map<string, GoalNodeDto[]>;
  orgName: string | null;
  /** The scope eyebrow above the current-scope card ("Talent Pod objective", "Focused objective"). */
  subjectEyebrow: string;
  /** Positional emphasis for the current-scope card: possessive gold ("own") or neutral ("focused"). */
  emphasis: SubjectEmphasis;
  onInspect: (id: string) => void;
  onResumeDraft: (id: string) => void;
}) {
  const directParent = block.ancestors.at(-1) ?? null;
  const higherAncestors = block.ancestors.slice(0, -1);

  return (
    <section>
      {directParent ? (
        <>
          {higherAncestors.length > 0 ? (
            <LineageChips ancestors={higherAncestors} />
          ) : null}
          <DirectionCard
            cycleId={cycleId}
            node={directParent}
            orgName={orgName}
            sectionLabel="Aligned to"
            onInspect={onInspect}
          />
          <AlignmentConnector state={block.node.state} />
        </>
      ) : null}

      <CurrentScopeCard
        cycleId={cycleId}
        node={block.node}
        eyebrow={subjectEyebrow}
        emphasis={emphasis}
        onInspect={onInspect}
        onResumeDraft={onResumeDraft}
      />

      <div className="mt-6">
        {/* The established cascade is a read/manage surface: it shows what is aligned beneath this
            subject but offers no create here — authoring happens only where the parent + scope are
            already unambiguous (an empty working context). The junction from the subject into this
            group is deferred; the tree handles sibling-to-sibling connection. */}
        <Downstream
          cycleId={cycleId}
          childNodes={block.children}
          childrenByParent={childrenByParent}
          onInspect={onInspect}
          onResumeDraft={onResumeDraft}
        />
      </div>
    </section>
  );
}

// ── Empty own-unit: choose a direction and create ─────────────────────────────────

function EmptyUnitContext({
  cycleId,
  unit,
  candidates,
  orgName,
  canAuthor,
  onInspect,
  onCreate,
}: {
  cycleId: string;
  unit: UnitContext;
  candidates: ObjectiveBlock[];
  orgName: string | null;
  canAuthor: boolean;
  onInspect: (id: string) => void;
  onCreate: (parentId: string, orgUnitId: string | null) => void;
}) {
  const [selectedId, setSelectedId] = useState(candidates[0]?.node.id ?? "");
  const selected = candidates.find((c) => c.node.id === selectedId) ?? candidates[0]!;
  const directParent = selected.node;
  const higherAncestors = selected.ancestors.slice(0, -1);
  const parentIsAncestor = selected.ancestors.length > 0; // an org objective, with company above

  return (
    <section>
      {candidates.length > 1 ? (
        <div className="mb-4">
          <DirectionSelector
            directions={candidates.map((c) => c.node)}
            selectedId={selected.node.id}
            onSelect={setSelectedId}
          />
        </div>
      ) : null}

      {parentIsAncestor && higherAncestors.length > 0 ? (
        <LineageChips ancestors={higherAncestors} />
      ) : null}
      <DirectionCard
        cycleId={cycleId}
        node={directParent}
        orgName={orgName}
        sectionLabel="Aligned to"
        onInspect={onInspect}
      />
      <AlignmentConnector />

      <EmptyObjectiveBranch
        unitName={unit.name}
        direction={directParent}
        canAuthor={canAuthor}
        onCreate={() => onCreate(directParent.id, unit.orgUnitId)}
      />
    </section>
  );
}

// ── The direct-parent direction card (company strategic OR organizational) ─────────

/**
 * The upstream direction — the subject's real direct parent (company strategic OR another
 * organizational objective). A meaningful business object, so it earns a card: its identity mark
 * leads on the left; accountable, measurement, and published status sit as aligned labeled facts.
 * Deliberately quieter than the current-scope card below it, so the current scope stays the anchor.
 * A small section label ("Aligned to") names its relationship to the objective below.
 */
function DirectionCard({
  cycleId,
  node,
  orgName,
  sectionLabel,
  onInspect,
}: {
  cycleId: string;
  node: GoalNodeDto;
  orgName: string | null;
  sectionLabel?: string;
  onInspect: (id: string) => void;
}) {
  const detail = useGoal(cycleId, node.id);
  const description = detail.data?.description?.trim() || null;
  const eyebrow =
    node.ownershipScope === "Company"
      ? companyEyebrow(orgName)
      : `${node.orgUnitName ?? "Organizational"} objective`;

  return (
    <div>
      {sectionLabel ? <p className="type-eyebrow mb-2 text-muted-foreground">{sectionLabel}</p> : null}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary/30" />
        <div className="relative p-5 pl-6 sm:p-6 sm:pl-7">
          <Button
            variant="outline"
            size="sm"
            className="absolute right-5 top-5 shrink-0 sm:right-6 sm:top-6"
            onClick={() => onInspect(node.id)}
          >
            View details
          </Button>
          <div className="flex items-start gap-4 sm:gap-5">
            <span
              aria-hidden
              className="hidden size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground sm:flex"
            >
              <ScopeMark className="size-7" muted />
            </span>
            <div className="min-w-0 flex-1 pr-24">
              <p className="type-eyebrow text-primary/80">{eyebrow}</p>
              <button
                type="button"
                onClick={() => onInspect(node.id)}
                className="mt-1 block rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <h3 className="text-lg font-semibold tracking-tight text-foreground hover:underline">
                  {node.title}
                </h3>
              </button>
              {description ? (
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 border-t border-border/60 pt-4">
            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              <Fact label="Status">
                <StatusLine tone={STATE_TONE[node.state]}>{STATE_LABEL[node.state]}</StatusLine>
              </Fact>
              <Fact label="Accountable">
                <PersonLine name={node.accountablePersonName} />
              </Fact>
              <MeasurementFact node={node} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── The current-scope objective (the workspace's visual anchor) ────────────────────

/**
 * Emphasis for the current-scope card. `own` — the actor's real placement — earns the possessive
 * gold "you are here" treatment; `focused` — a drilled node the actor does not personally own — is
 * marked as current with a neutral (non-gold) accent, never fabricating a personal scope (§4/§6).
 */
type SubjectEmphasis = "own" | "focused";

/**
 * The objective that defines the current working scope — the page's positional anchor. It shares the
 * DirectionCard grammar (mark, eyebrow, description, labeled facts) so the cascade reads as one
 * hierarchy, but carries the strongest treatment on the page: a soft accent halo and a stronger
 * border communicate "this is where I am", reinforced by a real text eyebrow (never color alone).
 * Planning-time only — status, accountability, and the measurement expectation; no health, no
 * fabricated progress.
 */
function CurrentScopeCard({
  cycleId,
  node,
  eyebrow,
  emphasis,
  onInspect,
  onResumeDraft,
}: {
  cycleId: string;
  node: GoalNodeDto;
  eyebrow: string;
  emphasis: SubjectEmphasis;
  onInspect: (id: string) => void;
  onResumeDraft: (id: string) => void;
}) {
  const detail = useGoal(cycleId, node.id);
  const description = detail.data?.description?.trim() || null;
  const isDraft = node.state === "Draft";
  const own = emphasis === "own";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-5 pl-6 sm:p-6 sm:pl-7",
        own
          ? "border-primary/50 shadow-raised ring-1 ring-primary/25"
          : "border-foreground/25 shadow-raised ring-1 ring-foreground/10",
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1.5", own ? "bg-primary" : "bg-foreground/40")}
      />
      {isDraft ? (
        <Button
          variant="outline"
          size="sm"
          className="absolute right-5 top-5 shrink-0 sm:right-6 sm:top-6"
          onClick={() => onResumeDraft(node.id)}
        >
          <Pencil className="size-3.5" data-icon="inline-start" /> Resume editing
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="absolute right-5 top-5 shrink-0 sm:right-6 sm:top-6"
          onClick={() => onInspect(node.id)}
        >
          View details
        </Button>
      )}

      <div className="flex items-start gap-4 sm:gap-5">
        <span
          aria-hidden
          className={cn(
            "hidden size-14 shrink-0 items-center justify-center rounded-full border sm:flex",
            own ? "border-primary/40 bg-primary/[0.08] text-primary" : "border-foreground/20 bg-muted text-foreground/70",
          )}
        >
          <ScopeMark className="size-9" muted={!own} />
        </span>
        <div className="min-w-0 flex-1 pr-24">
          <p className={cn("type-eyebrow", own ? "text-primary" : "text-muted-foreground")}>{eyebrow}</p>
          <button
            type="button"
            onClick={() => onInspect(node.id)}
            className="mt-1 block rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <h3 className="text-xl font-semibold tracking-tight text-foreground hover:underline">{node.title}</h3>
          </button>
          {description ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          <Fact label="Status">
            <StatusLine tone={STATE_TONE[node.state]}>{STATE_LABEL[node.state]}</StatusLine>
          </Fact>
          <Fact label="Accountable">
            <PersonLine name={node.accountablePersonName} />
          </Fact>
          <MeasurementFact node={node} />
        </dl>
      </div>
    </div>
  );
}

// ── Downstream cascade (children of the subject) ───────────────────────────────────

function Downstream({
  cycleId,
  childNodes,
  childrenByParent,
  onInspect,
  onResumeDraft,
}: {
  cycleId: string;
  childNodes: GoalNodeDto[];
  childrenByParent: Map<string, GoalNodeDto[]>;
  onInspect: (id: string) => void;
  onResumeDraft: (id: string) => void;
}) {
  if (childNodes.length === 0) {
    return <DownstreamEmpty />;
  }

  return (
    <div>
      {/* "Directly aligned" names the immediate children — the deeper generations that nest inside the
          tree are descendants, not direct alignments, so the count stays truthful even when the tree
          shows more cards than the number. */}
      <SectionEyebrow count={childNodes.length}>Directly aligned</SectionEyebrow>
      <AlignedTree
        cycleId={cycleId}
        siblings={childNodes}
        childrenByParent={childrenByParent}
        onInspect={onInspect}
        onResumeDraft={onResumeDraft}
      />
    </div>
  );
}

/**
 * The aligned-objectives tree. One sibling group shares a single vertical line down its left; each
 * objective is a node on that line — a filled circle when Published, a hollow ring when Draft, the
 * same state marker the upstream connector uses. A child that has its own aligned objectives nests
 * inline, indented one generation further with its own line and nodes — so the whole subtree reads
 * as one continuous cascade. (How the parent above connects into this group is intentionally left
 * for later; this handles only sibling-to-sibling and generation-to-generation.)
 */
function AlignedTree({
  cycleId,
  siblings,
  childrenByParent,
  onInspect,
  onResumeDraft,
}: {
  cycleId: string;
  siblings: GoalNodeDto[];
  childrenByParent: Map<string, GoalNodeDto[]>;
  onInspect: (id: string) => void;
  onResumeDraft: (id: string) => void;
}) {
  const count = siblings.length;
  return (
    <div className="mt-4">
      {siblings.map((child, index) => {
        const grandchildren = childrenByParent.get(child.id) ?? [];
        const hasNodeAbove = index > 0;
        const hasNodeBelow = index < count - 1;
        return (
          // The row owns the left gutter (pl-7): the line, node, and stub live in that margin, to the
          // LEFT of the card — the card fills the content area after it. A nested tree renders inside
          // this row, past the padding, so it indents one generation further.
          <div key={child.id} className={cn("relative pl-7 sm:pl-8", hasNodeBelow && "pb-3.5")}>
            {/* Segment from the node above down to this node (solid). Node centre sits level with the
                card's target mark: card padding (1.25rem) + half the 2.75rem mark = 2.625rem. */}
            {hasNodeAbove ? (
              <span aria-hidden className="absolute left-3 top-0 h-[2.625rem] w-px -translate-x-1/2 bg-border" />
            ) : null}
            {/* Segment from this node down to the next sibling (it runs the full height so it bridges
                this objective's whole subtree). */}
            {hasNodeBelow ? (
              <span aria-hidden className="absolute left-3 top-[2.625rem] bottom-0 w-px -translate-x-1/2 bg-border" />
            ) : null}
            {/* Short stub from the node across to the card. */}
            <span aria-hidden className="absolute left-3 top-[2.625rem] h-px w-3.5 -translate-y-1/2 bg-border" />
            {/* The objective's node, level with the card's target mark: filled Published / hollow Draft. */}
            <span
              aria-hidden
              className={cn(
                "absolute left-3 top-[2.625rem] z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
                child.state === "Draft" ? "border-2 border-primary bg-background" : "bg-primary",
              )}
            />
            <ChildObjectiveCard
              cycleId={cycleId}
              node={child}
              onInspect={onInspect}
              onResumeDraft={onResumeDraft}
            />
            {grandchildren.length > 0 ? (
              <AlignedTree
                cycleId={cycleId}
                siblings={grandchildren}
                childrenByParent={childrenByParent}
                onInspect={onInspect}
                onResumeDraft={onResumeDraft}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The empty state *beneath an established objective* — it means "nothing is aligned under this yet",
 * not "this scope has no objective" (the objective is the card above). A quiet marker: authoring a
 * lower-scope objective happens from that scope's own working context, not from here, so there is no
 * create affordance to offer.
 */
function DownstreamEmpty() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
      <ScopeMark className="size-5 shrink-0 text-muted-foreground/50" muted />
      No aligned objectives yet
    </div>
  );
}

/**
 * A downstream objective aligned beneath the subject. It shares the DirectionCard/CurrentScopeCard
 * grammar — identity mark, scope eyebrow, title, description, and the labeled Status · Accountable ·
 * Measurement facts — one step quieter (smaller mark and title, no accent), so the cascade reads as
 * one card family with the current scope still dominant. Its own aligned objectives nest beneath it
 * in the tree, so there is no drill affordance. Planning-time only: no progress, no fabricated
 * contribution.
 */
function ChildObjectiveCard({
  cycleId,
  node,
  onInspect,
  onResumeDraft,
}: {
  cycleId: string;
  node: GoalNodeDto;
  onInspect: (id: string) => void;
  onResumeDraft: (id: string) => void;
}) {
  const detail = useGoal(cycleId, node.id);
  const description = detail.data?.description?.trim() || null;
  const isDraft = node.state === "Draft";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:p-5">
      <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
        {isDraft ? (
          <Button variant="outline" size="sm" onClick={() => onResumeDraft(node.id)}>
            <Pencil className="size-3.5" data-icon="inline-start" /> Resume editing
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => onInspect(node.id)}>
            View details
          </Button>
        )}
      </div>

      <div className="flex items-start gap-3.5 sm:gap-4">
        <span
          aria-hidden
          className="hidden size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground sm:flex"
        >
          <ScopeMark className="size-6" muted />
        </span>
        <div className="min-w-0 flex-1 pr-24">
          <p className="type-eyebrow text-muted-foreground">{node.orgUnitName ?? "Organizational unit"}</p>
          <button
            type="button"
            onClick={() => onInspect(node.id)}
            className="mt-0.5 block rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <h4 className="text-base font-semibold tracking-tight text-foreground hover:underline">{node.title}</h4>
          </button>
          {description ? (
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-border/60 pt-3.5">
        <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <Fact label="Status">
            <StatusLine tone={STATE_TONE[node.state]}>{STATE_LABEL[node.state]}</StatusLine>
          </Fact>
          <Fact label="Accountable">
            <PersonLine name={node.accountablePersonName} />
          </Fact>
          <MeasurementFact node={node} />
        </dl>
      </div>
    </div>
  );
}

// ── Lineage & navigation ──────────────────────────────────────────────────────────

/**
 * Quiet ancestry above the direct parent — the higher strategy that gives orientation without
 * competing with the direct parent/current scope. A passive, non-interactive breadcrumb: it names
 * the chain a leader's objective ultimately ladders up to (nearest higher ancestor first, deeper
 * ancestors chained behind it), but is not a navigator — a leader stays anchored to their own scope.
 * Kept as a bordered pill so it reads as present context, not decoration.
 */
function LineageChips({ ancestors }: { ancestors: GoalNodeDto[] }) {
  // Nearest higher ancestor first — it is the most relevant orientation above the direct parent.
  // Each ancestor reads as "<scope> / <title>" — the scope prefix (e.g. "Company strategy") keeps a
  // bare title from being cryptic, while the title stays the emphasised part. No "Aligned to" prefix:
  // that relationship is labelled once, on the direct-parent card below.
  const ordered = [...ancestors].reverse();
  return (
    <div className="mb-3 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 text-xs text-muted-foreground">
      <ScopeMark className="mr-0.5 size-3.5 shrink-0 text-muted-foreground/60" muted />
      {ordered.map((node, index) => (
        <span key={node.id} className="inline-flex min-w-0 items-center gap-1.5">
          {index > 0 ? (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" aria-hidden />
          ) : null}
          <span className="inline-flex min-w-0 items-baseline gap-1">
            <span className="shrink-0 text-muted-foreground/70">{ancestorScopeLabel(node)}</span>
            <span aria-hidden className="shrink-0 text-muted-foreground/30">
              /
            </span>
            <span className="max-w-[22rem] truncate font-medium text-foreground/80">{node.title}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

/** A restrained scope descriptor for a quiet ancestor chip — "Company strategy", or the unit's name. */
function ancestorScopeLabel(node: GoalNodeDto): string {
  if (node.ownershipScope === "Company") return "Company strategy";
  if (node.ownershipScope === "Employee") return node.orgUnitName ?? "Individual";
  return node.orgUnitName ?? "Organizational";
}

/** The focused-mode top navigator: back to the default context, then the full path to the subject. */
function FocusTrail({ block, onFocus }: { block: ObjectiveBlock; onFocus: (id: string | null) => void }) {
  const trail = [...block.ancestors, block.node];
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Direction path">
      <button
        type="button"
        onClick={() => onFocus(null)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Building2 className="size-3.5" aria-hidden /> Direction
      </button>
      {trail.map((node, index) => {
        const isLast = index === trail.length - 1;
        return (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden />
            <button
              type="button"
              onClick={() => onFocus(isLast ? null : node.id)}
              disabled={isLast}
              className={cn(
                "max-w-[16rem] truncate rounded-md px-2 py-1 font-medium transition-colors",
                isLast
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {node.title}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

// ── Shared building blocks ─────────────────────────────────────────────────────────

function SectionEyebrow({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <p className="type-eyebrow flex items-center gap-1.5 text-muted-foreground">
      {children}
      {count != null && count > 0 ? (
        <>
          <span aria-hidden className="text-muted-foreground/50">
            ·
          </span>
          <span className="font-semibold tabular-nums text-foreground/80">{count}</span>
        </>
      ) : null}
    </p>
  );
}

/**
 * The vertical alignment connector between an objective card and the card directly beneath it.
 *
 * When `state` is given (a real objective sits below), the line runs flush from the card above down
 * to the lower card's top border, and the node sits centered on that border — half on the line, half
 * overlapping the card (painted above it) — filled when the objective it meets is Published, a hollow
 * ring when it is still a Draft. This tightens the gap and makes the link read as plugging into the
 * next objective. Without `state`, it keeps the legacy centered node (contexts not yet reworked).
 */
function AlignmentConnector({ state }: { state?: GoalNodeDto["state"] }) {
  if (!state) {
    return (
      <div className="flex justify-center py-2.5" aria-hidden>
        <span className="relative block h-12 w-0.5 rounded-full bg-gradient-to-b from-primary/60 via-primary/30 to-primary/40">
          <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background" />
        </span>
      </div>
    );
  }
  const draft = state === "Draft";
  return (
    <div className="relative flex h-7 justify-center" aria-hidden>
      <span className="h-full w-0.5 rounded-full bg-gradient-to-b from-primary/40 to-primary/70" />
      <span
        className={cn(
          "absolute bottom-0 left-1/2 z-10 size-3 -translate-x-1/2 translate-y-1/2 rounded-full",
          draft ? "border-2 border-primary bg-background" : "bg-primary",
        )}
      />
    </div>
  );
}

function EmptyObjectiveBranch({
  unitName,
  direction,
  canAuthor,
  onCreate,
}: {
  unitName: string;
  direction: GoalNodeDto;
  canAuthor: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
      <span className="sr-only">
        {unitName} has no objective aligned to {direction.title} yet.
      </span>
      <ScopeMark className="mx-auto size-14 text-foreground/70" />
      <p className="mt-3 text-base font-semibold tracking-tight text-foreground">No objective for {unitName} yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Define an objective aligned to <span className="font-medium text-foreground">“{direction.title}”</span>.
      </p>
      {canAuthor ? (
        <Button className="mt-5" onClick={onCreate}>
          <Plus className="size-4" data-icon="inline-start" /> Create objective for {unitName}
        </Button>
      ) : null}
    </div>
  );
}

function DirectionSelector({
  directions,
  selectedId,
  onSelect,
}: {
  directions: GoalNodeDto[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="type-eyebrow mr-1 text-muted-foreground">Align under</span>
      {directions.map((direction) => {
        const active = direction.id === selectedId;
        return (
          <button
            key={direction.id}
            type="button"
            onClick={() => onSelect(direction.id)}
            aria-pressed={active}
            className={cn(
              "max-w-[16rem] truncate rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "border-primary bg-primary/[0.08] text-foreground"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {direction.title}
          </button>
        );
      })}
    </div>
  );
}

function NoPublishedDirection({ canReachSetup }: { canReachSetup: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <ScopeMark className="mx-auto size-14 text-foreground/70" />
      <p className="mt-3 text-base font-semibold tracking-tight text-foreground">No published company direction yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Organizational objectives align beneath a published company strategic objective.
      </p>
      {canReachSetup ? (
        <Button variant="outline" className="mt-5" asChild>
          <a href="/cycle">Go to Cycle setup</a>
        </Button>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow text-muted-foreground/70">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function StatusLine({
  tone,
  children,
}: {
  tone: (typeof STATE_TONE)[keyof typeof STATE_TONE];
  children: React.ReactNode;
}) {
  const dot =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "info"
          ? "bg-info"
          : "bg-muted-foreground/50";
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
      <span aria-hidden className={cn("size-2 rounded-full", dot)} />
      {children}
    </span>
  );
}

function PersonLine({ name }: { name: string | null }) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name ?? "Unassigned"}</span>
    </span>
  );
}

function MeasurementFact({ node }: { node: GoalNodeDto }) {
  const summary = node.measurementSummary?.trim();
  if (!summary) return null;
  const Icon = node.progressSource === "Calculated" ? Layers : Gauge;
  return (
    <Fact label="Measurement">
      <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-foreground">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {summary}
      </span>
    </Fact>
  );
}

/**
 * The Fusion objective/scope mark — concentric rings closing on a filled center with four crosshair
 * ticks. A purpose-drawn "direction" glyph, distinct from a generic target icon. Inherits
 * `currentColor` for the rings; the center is the primary accent.
 */
