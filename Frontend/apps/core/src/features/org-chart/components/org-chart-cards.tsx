"use client";

import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Building2, ChevronDown, ChevronUp, Crosshair, Mail, MapPin, MoreHorizontal, Users } from "lucide-react";
import type { OrgChartPersonDto } from "@repo/api";
import { cn } from "@repo/ds";
import { isMore, type LensKey, type LensValue, type OrgTree } from "../model/org-chart-model";

export interface CardContext {
  tree: OrgTree;
  lensKey: LensKey;
  lensOf: (id: string) => LensValue | null;
  folded: Set<string>;
  onCopyEmail: (person: OrgChartPersonDto) => void;
  onCentre: (id: string) => void;
  onToggleFold: (id: string) => void;
}

/** Card chips and meta show unit and place, unless a lens other than division colours the chart. */
const showsPlace = (lens: LensKey) => lens === "division" || lens === "none";

export function OrgAvatar({ id, size, ctx }: { id: string; size: "xxl" | "xl" | "md" | "sm" | "xs"; ctx: CardContext }) {
  const person = ctx.tree.people.get(id);
  const lens = ctx.lensOf(id);
  return (
    <span
      aria-hidden
      className={cn("oc-av", `oc-${size}`, !lens?.color && "oc-neutral", id === ctx.tree.viewerKey && "oc-you")}
      style={lens?.color ? ({ "--h": lens.color } as CSSProperties) : undefined}
    >
      {person?.initials}
    </span>
  );
}

function Badge({ person, ctx }: { person: OrgChartPersonDto; ctx: CardContext }) {
  const t = useTranslations("orgChart.card");
  if (person.employeeKey === ctx.tree.viewerKey) return <span className="oc-badge">{t("you")}</span>;
  if (person.isNew) return <span className="oc-badge oc-new">{t("new")}</span>;
  return null;
}

function Actions({ person, ctx }: { person: OrgChartPersonDto; ctx: CardContext }) {
  const t = useTranslations("orgChart.card");
  return (
    <span className="oc-acts">
      {person.workEmail ? (
        <button type="button" className="oc-ib rounded-control-sm" aria-label={t("copyEmail")} title={t("copyEmail")}
          onClick={(event) => { event.stopPropagation(); ctx.onCopyEmail(person); }}>
          <Mail />
        </button>
      ) : null}
      <button type="button" className="oc-ib rounded-control-sm" aria-label={t("centre")} title={t("centre")}
        onClick={(event) => { event.stopPropagation(); ctx.onCentre(person.employeeKey); }}>
        <Crosshair />
      </button>
    </span>
  );
}

function LensChip({ lens }: { lens: LensValue | null }) {
  if (!lens) return null;
  return (
    <span className="oc-chip">
      <i className="oc-swatch" style={{ background: lens.color ?? "var(--muted-foreground)" }} />
      {lens.label}
    </span>
  );
}

/** A team leader: portrait card, the avatar breaking the top edge, the team's faces in an inlay band. */
export function LeadCard({ id, ctx }: { id: string; ctx: CardContext }) {
  const t = useTranslations("orgChart.card");
  const person = ctx.tree.people.get(id)!;
  const kids = ctx.tree.kids.get(id) ?? [];
  const faces = kids.filter((kid) => !isMore(kid));
  // Five faces, or four and a count, so the strip never runs into the team figures.
  const shown = faces.length > 5 ? 4 : 5;
  const isFolded = ctx.folded.has(id);
  const top = person.managerKey === null;
  const strong = (chunks: ReactNode) => <b>{chunks}</b>;
  return (
    <>
      <OrgAvatar id={id} size={top ? "xxl" : "xl"} ctx={ctx} />
      <Badge person={person} ctx={ctx} />
      <Actions person={person} ctx={ctx} />
      <span className="oc-nm">{person.displayName}</span>
      {person.jobTitle ? <span className="oc-ti">{person.jobTitle}</span> : null}
      <div className="oc-chips">
        {showsPlace(ctx.lensKey) ? (
          <>
            {person.unit ? <span className="oc-chip"><Building2 />{person.unit.name}</span> : null}
            {person.workLocation ? <span className="oc-chip"><MapPin />{person.workLocation}</span> : null}
          </>
        ) : (
          <LensChip lens={ctx.lensOf(id)} />
        )}
      </div>
      <div className="oc-team rounded-control">
        <span className="oc-strip">
          {faces.slice(0, shown).map((kid) => <OrgAvatar key={kid} id={kid} size="xs" ctx={ctx} />)}
          {faces.length > shown ? <span className="oc-plus">+{faces.length - shown}</span> : null}
        </span>
        <span className="oc-k">
          {person.totalCount > person.directCount
            ? t.rich("teamAll", { direct: person.directCount, total: person.totalCount, b: strong })
            : t.rich("team", { direct: person.directCount, b: strong })}
        </span>
      </div>
      {kids.length ? (
        <button type="button" className="oc-fold" aria-expanded={!isFolded} aria-label={isFolded ? t("showTeam") : t("foldTeam")}
          title={isFolded ? t("showTeam") : t("foldTeam")}
          onClick={(event) => { event.stopPropagation(); ctx.onToggleFold(id); }}>
          {isFolded ? <><ChevronDown />{kids.length}</> : <ChevronUp />}
        </button>
      ) : null}
    </>
  );
}

/** Everyone who doesn't lead a team: avatar, name, title, then place and start year. */
export function PersonCard({ id, ctx }: { id: string; ctx: CardContext }) {
  const t = useTranslations("orgChart.card");
  const person = ctx.tree.people.get(id)!;
  const dotted = person.dottedLineManagerKeys.map((key) => ctx.tree.people.get(key)).filter(Boolean);
  const facts = [
    person.workLocation,
    person.startYear ? t("since", { year: String(person.startYear) }) : null,
  ].filter(Boolean).join(" · ");
  return (
    <>
      <OrgAvatar id={id} size="md" ctx={ctx} />
      <Badge person={person} ctx={ctx} />
      <Actions person={person} ctx={ctx} />
      <span className="oc-t">
        <b>{person.displayName}</b>
        {person.jobTitle ? <span>{person.jobTitle}</span> : null}
        {showsPlace(ctx.lensKey) ? (
          facts || dotted.length ? (
            <span className="oc-m">
              {person.workLocation ? <MapPin /> : null}
              {facts}
              {dotted.map((manager) => (
                <span key={manager!.employeeKey} title={t("dotted", { name: manager!.displayName })}>
                  {facts ? " · " : ""}<MoreHorizontal />{manager!.displayName.split(" ")[0]}
                </span>
              ))}
            </span>
          ) : null
        ) : ctx.lensOf(id) ? (
          <span className="oc-m">
            <i className="oc-swatch" style={{ background: ctx.lensOf(id)!.color ?? "var(--muted-foreground)" }} />
            {ctx.lensOf(id)!.label}
          </span>
        ) : null}
      </span>
    </>
  );
}

/** A manager above the focus, as a compact pill. */
export function ChainPill({ id, ctx }: { id: string; ctx: CardContext }) {
  const person = ctx.tree.people.get(id)!;
  return (
    <>
      <OrgAvatar id={id} size="sm" ctx={ctx} />
      <span className="oc-t">
        <b>{person.displayName}</b>
        {person.jobTitle ? <span>{person.jobTitle}</span> : null}
      </span>
    </>
  );
}

/** People outside the viewer's slice of the chart, as a count. */
export function MoreCard({ id, ctx }: { id: string; ctx: CardContext }) {
  const t = useTranslations("orgChart.card");
  const count = ctx.tree.folds.get(id.slice("more:".length)) ?? 0;
  return (
    <>
      <span className="oc-well rounded-control"><Users /></span>
      <span className="oc-t">
        <b>{t("more", { count })}</b>
        <span>{t("moreDetail")}</span>
      </span>
    </>
  );
}
