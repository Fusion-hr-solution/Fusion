"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Maximize, Minus, Plus, Search, X } from "lucide-react";
import type { OrgChartDto, OrgChartPersonDto } from "@repo/api";
import { canAccessCoreOrgChart, canAccessCoreTeam, useAuth } from "@repo/auth";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@repo/ds";
import { PageHeader, PagePermissionNotice } from "@repo/ds/shell";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import { useOrgChart } from "../api/use-org-chart";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  boundsOf,
  buildTree,
  centerOn,
  createLens,
  dottedPath,
  edgePath,
  fitTo,
  fitTop,
  isMore,
  layoutChart,
  litLine,
  parentOf,
  searchPeople,
  stepFrom,
  zoomTier,
  type Camera,
  type LensKey,
  type OrgTree,
  type OrgView,
} from "../model/org-chart-model";
import { ChainPill, LeadCard, MoreCard, OrgAvatar, PersonCard, type CardContext } from "./org-chart-cards";

const PANEL_WIDTH = 344;
const SETTLE_MS = 470;

type FitRequest = { mode: "fit" | "top" } | { mode: "centre"; id: string; s: number } | null;

export default function OrgChartWorkspace() {
  const t = useTranslations("orgChart");
  const { user, isLoading: authLoading } = useAuth();
  const canView = canAccessCoreOrgChart(user);
  const chart = useOrgChart();

  if (authLoading) return <Frame title={t("title")}><StageSkeleton /></Frame>;
  if (!canView) {
    return (
      <div className="p-6">
        <PageHeader title={t("title")} />
        <PagePermissionNotice title={t("access.title")} description={t("access.description")} />
      </div>
    );
  }
  if (chart.isLoading || (!chart.data && !chart.error)) return <Frame title={t("title")}><StageSkeleton /></Frame>;
  if (chart.error || !chart.data) {
    return (
      <Frame title={t("title")}>
        <div className="grid flex-1 place-items-center bg-section px-6">
          <Alert variant="destructive" className="max-w-xl">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t("states.error")}</AlertTitle>
            <AlertDescription>
              {chart.error?.message}
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void chart.refetch()}>
                {t("states.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </Frame>
    );
  }
  if (!chart.data.people.length) {
    return (
      <Frame title={t("title")}>
        <div className="grid flex-1 place-items-center bg-section px-6">
          <div className="grid justify-items-center gap-3">
            <p className="type-body-secondary">{t("states.empty")}</p>
            {canAccessEmployeeRoster(user) ? (
              <Button asChild variant="outline" size="sm"><Link href="/people">{t("states.emptyAction")}</Link></Button>
            ) : null}
          </div>
        </div>
      </Frame>
    );
  }
  return <OrgChart data={chart.data} />;
}

function Frame({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[680px] flex-col overflow-hidden">
      <header className="shrink-0 px-6 pt-5">
        <PageHeader title={title} description={description} actions={actions} className="mb-4" />
      </header>
      {children}
    </div>
  );
}

function StageSkeleton() {
  return (
    <>
      <div className="flex shrink-0 items-center gap-3 border-y px-6 py-3">
        <Skeleton className="h-9 w-72 rounded-control" />
        <Skeleton className="h-9 w-40 rounded-control" />
      </div>
      <div className="grid flex-1 place-items-center bg-section">
        <div className="grid justify-items-center gap-10">
          <Skeleton className="h-52 w-64 rounded-surface" />
          <div className="flex gap-12">
            <Skeleton className="h-20 w-64 rounded-surface" />
            <Skeleton className="h-20 w-64 rounded-surface" />
          </div>
        </div>
      </div>
    </>
  );
}

function OrgChart({ data }: { data: OrgChartDto }) {
  const t = useTranslations("orgChart");
  const { user } = useAuth();
  const params = useSearchParams();
  const tree = useMemo(() => buildTree(data), [data]);

  const requested = params.get("focus");
  const initialFocus = requested && tree.people.has(requested) ? requested : tree.viewerKey;
  const [view, setView] = useState<OrgView>(params.get("view") === "company" || !initialFocus ? "company" : "focus");
  const [focus, setFocus] = useState<string | null>(initialFocus);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set());
  const [lensKey, setLensKey] = useState<LensKey>("division");
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(requested && tree.people.has(requested) ? requested : null);
  const [lit, setLit] = useState<string | null>(null);
  const [animate, setAnimate] = useState(true);
  const [fitRequest, setFitRequest] = useState<FitRequest>({ mode: view === "focus" ? "top" : "fit" });

  const layout = useMemo(() => layoutChart(tree, { view, focus, folded, unfolded }), [tree, view, focus, folded, unfolded]);
  const lensOf = useMemo(() => createLens(tree, lensKey, t("lens.leadership")), [tree, lensKey, t]);
  const litIds = useMemo(() => litLine(tree, lit), [tree, lit]);

  // ── Camera: transform applied straight to the world element, not through React ──
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cam = useRef<Camera>({ x: 0, y: 0, s: 1 });
  const flight = useRef(0);
  const [tier, setTier] = useState<"near" | "mid" | "far">("near");
  const [zoomLabel, setZoomLabel] = useState("100%");

  const applyCam = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.style.transform = `translate(${cam.current.x}px, ${cam.current.y}px) scale(${cam.current.s})`;
    setTier(zoomTier(cam.current.s));
    setZoomLabel(`${Math.round(cam.current.s * 100)}%`);
  }, []);

  const flyTo = useCallback((target: Camera, ms = 560) => {
    cancelAnimationFrame(flight.current);
    const from = { ...cam.current };
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      cam.current = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, s: from.s + (target.s - from.s) * e };
      applyCam();
      if (k < 1) flight.current = requestAnimationFrame(step);
    };
    flight.current = requestAnimationFrame(step);
  }, [applyCam]);

  const viewport = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 1200, height: rect?.height ?? 700, panel: selected ? PANEL_WIDTH : 0 };
  }, [selected]);

  const zoomBy = useCallback((factor: number, cx?: number, cy?: number) => {
    const v = viewport();
    const px = cx ?? v.width / 2;
    const py = cy ?? v.height / 2;
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.current.s * factor));
    const k = s / cam.current.s;
    cancelAnimationFrame(flight.current);
    cam.current = { s, x: px - (px - cam.current.x) * k, y: py - (py - cam.current.y) * k };
    applyCam();
  }, [applyCam, viewport]);

  useLayoutEffect(() => {
    if (!fitRequest) return;
    const v = viewport();
    if (fitRequest.mode === "centre") {
      const node = layout.nodes.get(fitRequest.id);
      if (node) flyTo(centerOn(node, v, fitRequest.s), 700);
    } else {
      const bounds = boundsOf(layout.nodes);
      flyTo(fitRequest.mode === "top" ? fitTop(bounds, v) : fitTo(bounds, v));
    }
    setFitRequest(null);
  }, [fitRequest, layout, flyTo, viewport]);

  // Edges wait for the cards to settle in their new places.
  const [edgesShown, setEdgesShown] = useState(false);
  useEffect(() => {
    setEdgesShown(false);
    const timer = window.setTimeout(() => setEdgesShown(true), animate ? SETTLE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [layout, animate]);

  // Wheel zooms around the pointer.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("[data-oc-overlay]")) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? 1.12 : 0.89, event.clientX - rect.left, event.clientY - rect.top);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  // Drag pans; a drag never counts as a click on what it started on.
  const dragged = useRef(false);
  const [panning, setPanning] = useState(false);
  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-oc-overlay]")) return;
    cancelAnimationFrame(flight.current);
    const start = { x: event.clientX, y: event.clientY, cx: cam.current.x, cy: cam.current.y };
    dragged.current = false;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) <= 5) return;
      if (!dragged.current) setPanning(true);
      dragged.current = true;
      cam.current = { ...cam.current, x: start.cx + dx, y: start.cy + dy };
      applyCam();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPanning(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // ── Actions ──
  const relayout = (fit: FitRequest, still = false) => {
    setAnimate(!still);
    setFitRequest(fit);
  };
  const centreOn = (id: string) => {
    setView("focus");
    setFocus(id);
    setSelected(id);
    setLit(null);
    relayout({ mode: "top" });
  };
  const select = (id: string) => {
    setSelected(id);
    setLit(view === "company" ? id : null);
    setAnimate(false);
  };
  const goTo = (id: string) => {
    setQuery("");
    if (view === "focus") {
      centreOn(id);
      return;
    }
    setSelected(id);
    setLit(id);
    setFolded((current) => {
      const next = new Set(current);
      for (let up = parentOf(tree, id); up; up = parentOf(tree, up)) next.delete(up);
      return next;
    });
    relayout({ mode: "centre", id, s: 0.9 });
  };
  const toggleFold = (id: string) => {
    const flip = (current: Set<string>) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    };
    if (view === "focus") {
      setUnfolded((current) => (layout.folded.has(id) ? new Set(current).add(id) : flip(current)));
    } else setFolded(flip);
    relayout(null);
  };
  const switchView = (next: OrgView) => {
    if (next === "focus" && view === "focus") setFocus(tree.viewerKey);
    if (next === "focus" && !focus) setFocus(tree.viewerKey);
    setView(next);
    setLit(null);
    relayout({ mode: next === "focus" ? "top" : "fit" });
  };
  const copyEmail = (person: OrgChartPersonDto) => {
    if (!person.workEmail) return;
    void navigator.clipboard?.writeText(person.workEmail).then(() => toast.success(t("card.copied")));
  };

  const ctx: CardContext = {
    tree, lensKey, lensOf, folded: layout.folded,
    onCopyEmail: copyEmail, onCentre: centreOn, onToggleFold: toggleFold,
  };

  // ── Keyboard: Enter selects; arrows move to the manager, reports and peers ──
  function onNodeKey(event: KeyboardEvent<HTMLDivElement>, id: string, kind: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (kind === "chain") centreOn(id);
      else if (!isMore(id)) select(id);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = isMore(id) ? null : stepFrom(tree, id, event.key);
    if (!next) return;
    if (!layout.nodes.has(next)) {
      centreOn(next);
      return;
    }
    setSelected(next);
    setLit(view === "company" ? next : null);
    setAnimate(false);
    flyTo(centerOn(layout.nodes.get(next)!, viewport(), cam.current.s), 360);
    requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>(`[data-oc-id="${CSS.escape(next)}"]`)?.focus({ preventScroll: true }));
  }

  // ── Search ──
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState(0);
  const hits = useMemo(() => searchPeople(tree, query), [tree, query]);
  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && hits.length) {
      event.preventDefault();
      setHit((current) => (current + (event.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
    }
    if (event.key === "Enter" && hits[hit]) {
      event.preventDefault();
      goTo(hits[hit]!.employeeKey);
    }
    if (event.key === "Escape") setQuery("");
  }

  // ── Legend ──
  const legend = useMemo(() => {
    if (lensKey === "none") return [];
    const counts = new Map<string, { key: string; label: string; color: string | null; n: number }>();
    for (const [id, node] of layout.nodes) {
      if (node.kind === "chain" || node.kind === "more") continue;
      const lens = lensOf(id);
      if (!lens) continue;
      const entry = counts.get(lens.key) ?? { ...lens, n: 0 };
      entry.n += 1;
      counts.set(lens.key, entry);
    }
    return [...counts.values()].sort((a, b) => (a.key === "lead" ? -1 : b.key === "lead" ? 1 : a.label.localeCompare(b.label)));
  }, [layout, lensOf, lensKey]);

  const divisions = useMemo(() => new Set(data.people.map((p) => p.unit?.divisionId).filter(Boolean)).size, [data]);
  const focusPerson = focus ? tree.people.get(focus) : undefined;
  const aroundLabel = !focus || focus === tree.viewerKey ? t("views.aroundYou") : t("views.aroundName", { name: focusPerson?.displayName.split(" ")[0] ?? "" });
  const bounds = boundsOf(layout.nodes);

  const profileHref = (person: OrgChartPersonDto): string | null => {
    if (person.employeeKey === tree.viewerKey) return "/profile";
    if (canAccessEmployeeRoster(user)) return `/people/${person.employeeKey}`;
    if (canAccessCoreTeam(user) && person.managerKey === tree.viewerKey) return `/people/${person.employeeKey}`;
    return null;
  };

  return (
    <Frame
      title={t("title")}
      description={t("meta", { people: data.people.length, divisions })}
      actions={
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(next) => { if (next === "focus" || next === "company") switchView(next); }}
          aria-label={t("views.label")}
          className="rounded-control border bg-inlay p-0.5"
        >
          {tree.viewerKey || focus ? (
            <ToggleGroupItem value="focus" className="px-3 text-sm text-muted-foreground data-[state=on]:bg-foreground! data-[state=on]:text-background! data-[state=on]:shadow-raised">
              {aroundLabel}
            </ToggleGroupItem>
          ) : null}
          <ToggleGroupItem value="company" className="px-3 text-sm text-muted-foreground data-[state=on]:bg-foreground! data-[state=on]:text-background! data-[state=on]:shadow-raised">
            {t("views.company")}
          </ToggleGroupItem>
        </ToggleGroup>
      }
    >
      <div className="flex shrink-0 items-center gap-3 border-y px-6 py-3">
        <div className="relative w-80 max-w-full">
          <Search className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t("search.label")}
            placeholder={t("search.label")}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setHit(0); }}
            onKeyDown={onSearchKey}
            className="ps-9"
            autoComplete="off"
          />
          {query.trim() ? (
            <div role="listbox" aria-label={t("search.label")} className="absolute inset-s-0 top-[calc(100%+6px)] z-30 grid w-[22rem] gap-0.5 rounded-menu border bg-popover p-1 shadow-overlay">
              {hits.length ? hits.map((person, index) => (
                <button
                  key={person.employeeKey}
                  type="button"
                  role="option"
                  aria-selected={index === hit}
                  onMouseEnter={() => setHit(index)}
                  onClick={() => goTo(person.employeeKey)}
                  className={cn("flex w-full items-center gap-2.5 rounded-inset px-2 py-1.5 text-start outline-none", index === hit && "bg-inlay")}
                >
                  <OrgAvatar id={person.employeeKey} size="sm" ctx={ctx} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{person.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[person.jobTitle, person.unit?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              )) : <p className="px-2.5 py-2 text-sm text-muted-foreground">{t("search.none")}</p>}
            </div>
          ) : null}
        </div>
        <Select value={lensKey} onValueChange={(value) => { setLensKey(value as LensKey); setFilter(null); setAnimate(false); }}>
          <SelectTrigger aria-label={t("lens.label")} className="w-auto gap-2">
            <span className="text-muted-foreground">{t("lens.label")}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="division">{t("lens.division")}</SelectItem>
            <SelectItem value="location">{t("lens.location")}</SelectItem>
            <SelectItem value="none">{t("lens.none")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        ref={stageRef}
        className={cn("oc-stage flex-1 bg-section", panning && "oc-panning")}
        onPointerDown={onPointerDown}
        onClickCapture={(event) => {
          if (dragged.current) {
            event.stopPropagation();
            event.preventDefault();
            dragged.current = false;
          }
        }}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (!target.closest(".oc-node, [data-oc-overlay]") && selected) {
            setSelected(null);
            setLit(null);
            setAnimate(false);
          }
        }}
      >
        <div ref={worldRef} className={cn("oc-world", !animate && "oc-still", tier === "mid" && "oc-z-mid", tier === "far" && "oc-z-far")}>
          <svg className={cn("oc-edges", !edgesShown && "oc-hide")} width={Math.max(1, bounds.x1 + 80)} height={Math.max(1, bounds.y1 + 80)} aria-hidden>
            {edgesShown ? <Edges tree={tree} layout={layout} lit={litIds} /> : null}
          </svg>
          {[...layout.nodes].map(([id, node]) => {
            const lens = isMore(id) ? null : lensOf(id);
            const isChain = node.kind === "chain";
            const label = isMore(id) ? undefined : tree.people.get(id)?.displayName;
            return (
              <div
                key={id}
                data-oc-id={id}
                role={isMore(id) ? undefined : "button"}
                tabIndex={isMore(id) ? -1 : 0}
                aria-label={label}
                aria-pressed={isMore(id) || isChain ? undefined : selected === id}
                onKeyDown={(event) => onNodeKey(event, id, node.kind)}
                onClick={() => (isChain ? centreOn(id) : isMore(id) ? undefined : select(id))}
                className={cn(
                  "oc-node bg-card",
                  node.kind === "lead" ? cn("oc-lead rounded-surface", node.top && "oc-top") : "oc-pc rounded-surface",
                  isChain && "oc-chain",
                  node.kind === "more" && "oc-more",
                  id === tree.viewerKey && !isChain && "oc-you",
                  selected === id && "oc-sel",
                  filter && (!lens || lens.key !== filter) && "oc-dim",
                )}
                style={{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  width: node.w,
                  height: node.h,
                  ...(lens?.color ? ({ "--lc": lens.color } as CSSProperties) : {}),
                }}
              >
                {node.kind === "lead" ? <LeadCard id={id} ctx={ctx} />
                  : node.kind === "more" ? <MoreCard id={id} ctx={ctx} />
                  : isChain ? <ChainPill id={id} ctx={ctx} />
                  : <PersonCard id={id} ctx={ctx} />}
              </div>
            );
          })}
        </div>

        {legend.length ? (
          <div data-oc-overlay className="absolute bottom-3.5 start-3.5 flex max-w-[calc(100%-10rem)] flex-wrap gap-1.5">
            {legend.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={filter === entry.key}
                aria-label={t("lens.filter", { label: entry.label })}
                onClick={() => { setFilter((current) => (current === entry.key ? null : entry.key)); setAnimate(false); }}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border bg-popover px-2.5 text-xs",
                  filter === entry.key && "border-foreground",
                  filter && filter !== entry.key && "opacity-45",
                )}
              >
                {entry.color ? <i className="oc-swatch" style={{ background: entry.color }} /> : null}
                {entry.label}
                <span className="text-muted-foreground tabular-nums">{entry.n}</span>
              </button>
            ))}
          </div>
        ) : null}

        <span className="pointer-events-none absolute bottom-[18px] end-[58px] text-xs text-muted-foreground tabular-nums">{zoomLabel}</span>
        <div data-oc-overlay className="absolute bottom-3.5 end-3.5 grid overflow-hidden rounded-control border bg-popover shadow-overlay">
          <button type="button" aria-label={t("zoom.in")} onClick={() => zoomBy(1.25)} className="grid h-8 w-[34px] place-items-center text-muted-foreground hover:bg-inlay hover:text-foreground"><Plus className="size-4" /></button>
          <button type="button" aria-label={t("zoom.out")} onClick={() => zoomBy(0.8)} className="grid h-8 w-[34px] place-items-center border-t text-muted-foreground hover:bg-inlay hover:text-foreground"><Minus className="size-4" /></button>
          <button type="button" aria-label={t("zoom.fit")} onClick={() => flyTo(fitTo(boundsOf(layout.nodes), viewport()))} className="grid h-8 w-[34px] place-items-center border-t text-muted-foreground hover:bg-inlay hover:text-foreground"><Maximize className="size-4" /></button>
        </div>

        {selected && tree.people.has(selected) ? (
          <PersonPanel
            person={tree.people.get(selected)!}
            tree={tree}
            ctx={ctx}
            showCentre={view === "company" || focus !== selected}
            profileHref={profileHref(tree.people.get(selected)!)}
            onClose={() => { setSelected(null); setLit(null); setAnimate(false); }}
            onGoTo={goTo}
            onCentre={centreOn}
          />
        ) : null}
      </div>
    </Frame>
  );
}

function Edges({ tree, layout, lit }: { tree: OrgTree; layout: ReturnType<typeof layoutChart>; lit: Set<string> }) {
  const paths: { key: string; d: string; className?: string }[] = [];
  for (const edge of layout.edges) {
    const to = layout.nodes.get(edge.to);
    if (!to) continue;
    const isLit = lit.has(edge.to) && lit.has(edge.from);
    paths.push({ key: `${edge.from}>${edge.to}`, d: edgePath(edge, to), className: isLit ? "oc-lit" : isMore(edge.to) ? "oc-dash" : undefined });
  }
  for (const [id, person] of tree.people) {
    const from = layout.nodes.get(id);
    if (!from || from.kind === "chain") continue;
    for (const key of person.dottedLineManagerKeys) {
      const to = layout.nodes.get(key);
      if (to) paths.push({ key: `${id}~${key}`, d: dottedPath(from, to), className: "oc-dot" });
    }
  }
  // Lit lines draw last, over the rest.
  paths.sort((a, b) => Number(a.className === "oc-lit") - Number(b.className === "oc-lit"));
  return <>{paths.map((path) => <path key={path.key} d={path.d} className={path.className} />)}</>;
}

function PersonPanel({
  person, tree, ctx, showCentre, profileHref, onClose, onGoTo, onCentre,
}: {
  person: OrgChartPersonDto;
  tree: OrgTree;
  ctx: CardContext;
  showCentre: boolean;
  profileHref: string | null;
  onClose: () => void;
  onGoTo: (id: string) => void;
  onCentre: (id: string) => void;
}) {
  const t = useTranslations("orgChart.panel");
  const manager = person.managerKey ? tree.people.get(person.managerKey) : undefined;
  const dotted = person.dottedLineManagerKeys.map((key) => tree.people.get(key)).filter((p): p is OrgChartPersonDto => Boolean(p));
  const fact = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[80px_1fr] gap-2.5 border-b py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
  const personLink = (target: OrgChartPersonDto) => (
    <button type="button" className="text-start font-semibold hover:underline" onClick={() => onGoTo(target.employeeKey)}>{target.displayName}</button>
  );
  return (
    <aside
      data-oc-overlay
      aria-label={person.displayName}
      className="absolute inset-y-3 end-3 z-20 flex w-[320px] cursor-default flex-col gap-4 overflow-auto rounded-surface border bg-popover p-[18px] shadow-overlay"
    >
      <Button variant="ghost" size="icon-sm" aria-label={t("close")} onClick={onClose} className="absolute end-3 top-3">
        <X className="size-4" />
      </Button>
      <div className="grid gap-2.5">
        <OrgAvatar id={person.employeeKey} size="xl" ctx={ctx} />
        <div>
          <h2 className="type-panel-title">{person.displayName}</h2>
          {person.jobTitle ? <p className="type-body-secondary">{person.jobTitle}</p> : null}
        </div>
        {person.isNew && person.startYear ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <i className="oc-swatch" style={{ background: "var(--primary)" }} />
            {t("joined", { year: String(person.startYear) })}
          </span>
        ) : null}
      </div>
      <dl className="grid border-t">
        {person.unit ? fact(t("unit"), (
          <>
            {person.unit.name}
            {person.unit.divisionName && person.unit.divisionName !== person.unit.name ? (
              <span className="block text-muted-foreground">{person.unit.divisionName}</span>
            ) : null}
          </>
        )) : null}
        {fact(t("manager"), manager ? personLink(manager) : <span className="text-muted-foreground">{t("top")}</span>)}
        {dotted.length ? fact(t("dotted"), <span className="grid">{dotted.map((m) => <span key={m.employeeKey}>{personLink(m)}</span>)}</span>) : null}
        {fact(t("team"), person.directCount
          ? person.totalCount > person.directCount
            ? t("teamCountAll", { direct: person.directCount, total: person.totalCount })
            : t("teamCount", { direct: person.directCount })
          : <span className="text-muted-foreground">{t("noReports")}</span>)}
        {person.workLocation ? fact(t("location"), person.workLocation) : null}
        {person.startYear ? fact(t("since"), String(person.startYear)) : null}
        {person.workEmail ? fact(t("email"), person.workEmail) : null}
      </dl>
      {showCentre || profileHref ? (
        <div className="flex flex-wrap gap-2">
          {showCentre ? <Button variant="outline" size="sm" onClick={() => onCentre(person.employeeKey)}>{t("centre")}</Button> : null}
          {profileHref ? <Button asChild variant="outline" size="sm"><Link href={profileHref}>{t("openProfile")}</Link></Button> : null}
        </div>
      ) : null}
    </aside>
  );
}
