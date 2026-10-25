"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronsUpDown,
  Eye,
  FileCheck2,
  History,
  Home,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  MessageSquareText,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Skeleton } from "../components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { FUSION_MODULE_ICONS } from "./modules";
import type { ShellUserPanelLink } from "./shell-user-panel";
import type {
  FusionSidebarModule,
  FusionSidebarProps,
  FusionSidebarSettings,
  FusionSidebarSettingsGroup,
  ShellNavItem,
  ShellNavSection,
} from "./types";

/** Where Fusion Settings opens: Preferences, served by the shell. */
const SETTINGS_HREF = "/settings";

/**
 * The page "Back to …" returns to, kept for the browser session: the key `@repo/api`'s `readSettingsReturn`
 * reads. Settings pages themselves are never kept.
 */
const SETTINGS_RETURN_KEY = "fusion.settings.back";
const SETTINGS_PATH = /^(\/core|\/performance)?\/settings(\/|$|\?)/;

function rememberReturn() {
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (!SETTINGS_PATH.test(path)) window.sessionStorage.setItem(SETTINGS_RETURN_KEY, path);
  } catch {
    // A convenience only: without it, Back goes Home.
  }
}

/** Each settings section's mark: same section, same icon wherever it is listed. */
const SETTINGS_SECTION_ICONS: Record<string, LucideIcon> = {
  preferences: SlidersHorizontal,
  notifications: Bell,
  company: Building2,
  "employee-fields": ListChecks,
  roles: ShieldCheck,
  invitations: Mail,
  "change-history": History,
  "rating-scale": BarChart3,
  competencies: Award,
  "review-questions": MessageSquareText,
  reviews: FileCheck2,
  planning: Target,
  conversations: MessageSquare,
  "ai-and-data": Sparkles,
};

function isItemActive(activePath: string, item: ShellNavItem): boolean {
  if (item.exact || item.href === "/") return activePath === item.href;
  return activePath === item.href || activePath.startsWith(`${item.href}/`);
}

/** The absolute paths of a module's navigation items, which the shared hook counts work under. */
export function sectionPaths(basePath: string, sections: readonly ShellNavSection[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => absolutePath(basePath, item.href)));
}

/** Absolute navigation path of a module-relative item, the key section counts use. */
function absolutePath(basePath: string, href: string): string {
  return href === "/" ? basePath || "/" : `${basePath}${href}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** A count of waiting work: a number when expanded, a dot on the rail, nothing at zero. */
function Count({ value, collapsed }: { value?: number; collapsed: boolean }) {
  if (!value) return null;
  if (collapsed) {
    return <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground" />;
  }
  return (
    <span className="ml-auto inline-grid h-5 min-w-[22px] place-items-center rounded-detail bg-inlay px-1.5 text-[11.5px] font-semibold tabular-nums text-foreground ring-1 ring-inset ring-border">
      {value}
    </span>
  );
}

function withTooltip(collapsed: boolean, label: string, node: ReactNode) {
  if (!collapsed) return node;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function rowClass(active: boolean, collapsed: boolean, disabled = false) {
  return cn(
    "relative flex items-center gap-3 rounded-control px-2.5 py-2 text-sm font-medium transition-colors",
    active ? "bg-inlay text-foreground" : "text-muted-foreground hover:bg-inlay/60 hover:text-foreground",
    disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
    collapsed && "justify-center",
  );
}

const BRAND_MARK =
  "grid size-9 shrink-0 place-items-center rounded-detail bg-primary text-base font-bold text-primary-foreground";

function ActiveMark({ active }: { active: boolean }) {
  return active ? <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" /> : null;
}

function moduleIcon(module: Pick<FusionSidebarModule, "key" | "icon">) {
  return module.icon ?? FUSION_MODULE_ICONS[module.key] ?? Home;
}

function ModuleMark({ module, emphasis }: { module: Pick<FusionSidebarModule, "key" | "icon">; emphasis: boolean }) {
  const Icon = moduleIcon(module);
  return (
    <span
      className={cn(
        "grid size-[30px] shrink-0 place-items-center rounded-detail",
        emphasis ? "bg-primary/15 text-primary" : "bg-inlay text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

/**
 * The shell-owned Fusion sidebar (fusion-navigation): tenant brand, Home first, the module switcher (or,
 * on Home, the module list), the current module's own sections with counts of waiting work, Recent and the
 * person. Pure presentation: each app passes its sections and the shared navigation state from
 * `useFusionNavigation` in `@repo/api/query`. Below 1024px, or on request, it collapses to an icon rail.
 */
export function FusionSidebar({
  mode = "module",
  settings,
  tenantName,
  homeCount,
  modules,
  currentModuleKey,
  basePath = "",
  activePath,
  sections = [],
  sectionCounts = {},
  pending = false,
  recent = [],
  person,
}: FusionSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const inSettings = mode === "settings" && settings !== undefined;
  const onHome = !currentModuleKey && !inSettings;
  const current = inSettings ? undefined : modules.find((module) => module.key === currentModuleKey);

  useEffect(() => {
    // Every page outside Settings is where "Back to …" may need to return.
    if (!inSettings) rememberReturn();
  }, [inSettings, activePath]);

  useEffect(() => {
    // At tablet widths a full navigation column turns a record into a narrow reading pane; the rail keeps
    // every destination and the brand mark expands it again.
    const query = window.matchMedia("(max-width: 1023px)");
    if (query.matches) setCollapsed(true);
    const handleChange = (event: MediaQueryListEvent) => setCollapsed(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  const switcher = current ? (
    <DropdownMenu>
      {withTooltip(
        collapsed,
        current.label,
        <DropdownMenuTrigger
          aria-label={collapsed ? `Switch module, current: ${current.label}` : undefined}
          className={cn(
            "relative flex w-full items-center gap-2.5 rounded-control text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            collapsed
              ? "justify-center p-1.5 hover:bg-inlay"
              : "border border-border bg-card py-2 pr-2.5 pl-2 hover:bg-inlay data-[state=open]:ring-2 data-[state=open]:ring-ring",
          )}
        >
          <ModuleMark module={current} emphasis />
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{current.label}</span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </>
          ) : null}
        </DropdownMenuTrigger>,
      )}
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-[316px] p-1.5">
        <DropdownMenuLabel className="px-2.5 pt-2 pb-1.5 type-meta font-normal text-muted-foreground">
          Switch module
        </DropdownMenuLabel>
        {modules.map((module) => {
          const active = module.key === current.key;
          return (
            <DropdownMenuItem key={module.key} asChild className={cn("gap-2.5 rounded-inset px-2.5 py-2", active && "bg-inlay")}>
              <a href={module.href}>
                <ModuleMark module={module} emphasis={active} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{module.label}</span>
                  {module.description ? (
                    <span className="truncate text-xs text-muted-foreground">{module.description}</span>
                  ) : null}
                </span>
                <Count value={module.count} collapsed={false} />
                {active ? <Check aria-label="Current module" className="size-4 shrink-0 text-primary" /> : null}
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        data-collapsed={collapsed}
        aria-label="Fusion navigation"
        className={cn(
          "dark relative flex h-screen shrink-0 flex-col border-r border-border bg-section text-foreground transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-[264px]",
        )}
      >
        {/* Brand: Fusion and the tenant */}
        <div className={cn("flex items-center gap-2.5 px-4 pt-4 pb-3", collapsed && "justify-center px-0")}>
          {collapsed ? (
            withTooltip(
              true,
              "Expand sidebar",
              <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className={BRAND_MARK}>
                F
              </button>,
            )
          ) : (
            <span aria-hidden className={BRAND_MARK}>
              F
            </span>
          )}
          {!collapsed ? (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold leading-tight">EY Fusion</span>
                {tenantName ? (
                  <span className="truncate text-xs text-muted-foreground">{tenantName}</span>
                ) : (
                  <Skeleton className="mt-1 h-2.5 w-28" />
                )}
              </span>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                className="grid size-7 shrink-0 place-items-center rounded-detail text-muted-foreground/70 transition-colors hover:bg-inlay hover:text-foreground"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {inSettings ? (
            <SettingsNavigation
              settings={settings}
              activePath={absolutePath(basePath, activePath)}
              basePath={basePath}
              collapsed={collapsed}
            />
          ) : (
          <>
          {/* Home, always first */}
          {withTooltip(
            collapsed,
            homeCount ? `Home ${homeCount}` : "Home",
            <a href="/" aria-current={onHome ? "page" : undefined} aria-label={collapsed ? "Home" : undefined} className={rowClass(onHome, collapsed)}>
              <ActiveMark active={onHome} />
              <Home className="size-4 shrink-0" />
              {!collapsed ? <span className="flex-1 truncate">Home</span> : null}
              <Count value={homeCount} collapsed={collapsed} />
            </a>,
          )}

          <div className="mx-1 my-2.5 h-px bg-border" />

          {onHome ? (
            // Home has no current module: the modules are listed here instead of the switcher.
            <div>
              {!collapsed ? (
                <p className="px-2.5 pt-1.5 pb-1.5 type-eyebrow text-muted-foreground/70">Modules</p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {modules.map((module) => {
                  const Icon = moduleIcon(module);
                  return (
                    <li key={module.key}>
                      {withTooltip(
                        collapsed,
                        module.count ? `${module.label} ${module.count}` : module.label,
                        <a href={module.href} aria-label={collapsed ? module.label : undefined} className={rowClass(false, collapsed)}>
                          <Icon className="size-4 shrink-0" />
                          {!collapsed ? <span className="flex-1 truncate">{module.label}</span> : null}
                          <Count value={module.count} collapsed={collapsed} />
                        </a>,
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <>
              <div className="mb-2">{switcher}</div>
              {pending ? (
                // Sections not known yet (session or workspace access resolving): stable rows in place.
                <div aria-busy aria-label="Loading navigation" className="flex flex-col gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={cn("flex items-center gap-3 px-2.5 py-2", collapsed && "justify-center")}>
                      <Skeleton className="size-4 shrink-0 rounded-detail" />
                      {!collapsed ? <Skeleton className="h-4 flex-1" /> : null}
                    </div>
                  ))}
                </div>
              ) : (
                sections.map((section, index) => (
                  <div key={`${section.title ?? "section"}-${index}`} className={cn(index > 0 && "mt-2")}>
                    {section.title && !collapsed ? (
                      <p className="px-2.5 pt-3 pb-1.5 type-eyebrow text-muted-foreground/70">{section.title}</p>
                    ) : null}
                    {section.title && collapsed && index > 0 ? <div className="mx-2 my-2 h-px bg-border" /> : null}
                    <ul className="flex flex-col gap-0.5">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <SectionItem
                            item={item}
                            active={isItemActive(activePath, item)}
                            collapsed={collapsed}
                            count={sectionCounts[absolutePath(basePath, item.href)]}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}

              {recent.length > 0 && !collapsed ? (
                <div className="mt-2">
                  <p className="px-2.5 pt-3 pb-1.5 type-eyebrow text-muted-foreground/70">Recent</p>
                  <ul className="flex flex-col gap-0.5">
                    {recent.map((record) => (
                      <li key={record.href}>
                        <RecentLink href={record.href} basePath={basePath}>
                          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm text-foreground/90">{record.label}</span>
                            <span className="truncate text-xs text-muted-foreground/70">{record.kind}</span>
                          </span>
                        </RecentLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
          </>
          )}
        </nav>

        <div className="mx-3 border-t border-border py-3">
          <PersonPanel collapsed={collapsed} {...person} />
        </div>
      </aside>
    </TooltipProvider>
  );
}

function SectionItem({
  item,
  active,
  collapsed,
  count,
}: {
  item: ShellNavItem;
  active: boolean;
  collapsed: boolean;
  count?: number;
}) {
  const Icon = item.icon;
  const value = count || (typeof item.badge === "number" ? item.badge : undefined);
  const content = (
    <span className={rowClass(active, collapsed, item.disabled)}>
      <ActiveMark active={active} />
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
      {!collapsed && item.disabled ? <Lock className="size-3.5 shrink-0 opacity-70" /> : null}
      {!item.disabled ? <Count value={value} collapsed={collapsed} /> : null}
    </span>
  );
  const target = item.navigateHref ?? item.href;
  const label = collapsed ? item.label : undefined;
  const node = item.disabled || item.pending ? (
    <div aria-disabled aria-label={label} className={item.pending ? "cursor-default" : undefined}>
      {content}
    </div>
  ) : item.shellRoute ? (
    // Leaves this app's basePath, so it is a document load by nature.
    <a href={target} aria-label={label} aria-current={active ? "page" : undefined}>
      {content}
    </a>
  ) : (
    <Link href={target} aria-label={label} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
  const tip = item.disabled && item.disabledReason ? item.disabledReason : value ? `${item.label} ${value}` : item.label;
  return collapsed || (item.disabled && item.disabledReason) ? (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="right">{tip}</TooltipContent>
    </Tooltip>
  ) : (
    node
  );
}

/** A record of this module stays a client navigation; anything else is a document load. */
function RecentLink({ href, basePath, children }: { href: string; basePath: string; children: ReactNode }) {
  const className = "flex items-start gap-3 rounded-control px-2.5 py-1.5 transition-colors hover:bg-inlay/60";
  if (basePath && (href === basePath || href.startsWith(`${basePath}/`) || href.startsWith(`${basePath}?`))) {
    return (
      <Link href={href.slice(basePath.length) || "/"} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function PersonPanel({
  collapsed,
  name,
  detail,
  detailPending = false,
  pending = false,
  links = [],
  onSignOut,
}: FusionSidebarProps["person"] & { collapsed: boolean }) {
  if (pending) {
    return (
      <div className={cn("flex items-center gap-2.5 p-1.5", collapsed && "justify-center")} aria-busy aria-label="Loading account">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        {!collapsed ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ) : null}
      </div>
    );
  }

  if (!name) {
    return (
      <a
        href="/auth/signin"
        className={cn(
          "flex items-center gap-2 rounded-control px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-inlay hover:text-foreground",
          collapsed && "justify-center",
        )}
      >
        <LogOut className="size-4 rotate-180" />
        {!collapsed ? <span>Sign in</span> : null}
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={collapsed ? name : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-control p-1.5 text-left outline-none transition-colors hover:bg-inlay focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-inlay text-[11px] font-semibold text-foreground/85 ring-1 ring-border">
          {initials(name)}
        </span>
        {!collapsed ? (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{name}</span>
              {detailPending ? (
                <Skeleton className="mt-1 h-2.5 w-20" />
              ) : detail ? (
                <span className="truncate text-xs text-muted-foreground">{detail}</span>
              ) : null}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/70" />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "start" : "end"} side={collapsed ? "right" : "top"} className="w-56">
        {links.map((link: ShellUserPanelLink) => {
          const Icon = link.icon;
          return (
            <DropdownMenuItem key={link.href} asChild>
              <a href={link.href} className="flex items-center gap-2.5">
                <Icon className="size-4" />
                {link.label}
              </a>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem asChild>
          <a href={SETTINGS_HREF} onClick={rememberReturn} className="flex items-center gap-2.5">
            <Settings className="size-4" />
            Settings
          </a>
        </DropdownMenuItem>
        {onSignOut ? <DropdownMenuSeparator /> : null}
        {onSignOut ? (
          <DropdownMenuItem onSelect={onSignOut} className="flex items-center gap-2.5">
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Settings mode: the way back, then each group with its sections (fusion-settings). */
function SettingsNavigation({
  settings,
  activePath,
  basePath,
  collapsed,
}: {
  settings: FusionSidebarSettings;
  activePath: string;
  basePath: string;
  collapsed: boolean;
}) {
  const backLabel = `Back to ${settings.back.label}`;
  // The open section is the one whose address matches most of the path: Preferences (`/settings`) is not current on
  // Notifications (`/settings/notifications`).
  const current = settings.groups
    .flatMap((group) => group.sections)
    .filter((section) => activePath === section.path || activePath.startsWith(`${section.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;
  return (
    <>
      {withTooltip(
        collapsed,
        backLabel,
        <a
          href={settings.back.href}
          aria-label={collapsed ? backLabel : undefined}
          className={cn(rowClass(false, collapsed), "font-semibold text-foreground")}
        >
          <ArrowLeft className="size-4 shrink-0" />
          {!collapsed ? <span className="flex-1 truncate">{backLabel}</span> : null}
        </a>,
      )}

      <div className="mx-1 my-2.5 h-px bg-border" />

      {settings.groups.map((group, index) => (
        <SettingsGroup
          key={group.key}
          group={group}
          first={index === 0}
          currentPath={current}
          basePath={basePath}
          collapsed={collapsed}
        />
      ))}
    </>
  );
}

function SettingsGroup({
  group,
  first,
  currentPath,
  basePath,
  collapsed,
}: {
  group: FusionSidebarSettingsGroup;
  first: boolean;
  currentPath: string | undefined;
  basePath: string;
  collapsed: boolean;
}) {
  return (
    <div className={cn(!first && "mt-2")} role="group" aria-label={group.viewOnly ? `${group.label}, view only` : group.label}>
      {!collapsed ? (
        <p className="flex items-center gap-1.5 px-2.5 pt-3 pb-1.5 type-eyebrow text-muted-foreground/70">
          {group.label}
          {group.viewOnly ? <Eye aria-label="View only" className="size-3.5" /> : null}
        </p>
      ) : !first ? (
        <div className="mx-2 my-2 h-px bg-border" />
      ) : null}
      {group.status === "loading" ? (
        <div aria-busy aria-label={`Loading ${group.label}`} className="flex flex-col gap-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={cn("flex items-center gap-3 px-2.5 py-2", collapsed && "justify-center")}>
              <Skeleton className="size-4 shrink-0 rounded-detail" />
              {!collapsed ? <Skeleton className="h-4 flex-1" /> : null}
            </div>
          ))}
        </div>
      ) : group.status === "error" ? (
        withTooltip(
          collapsed,
          `${group.label} didn't load`,
          <div className={cn("flex items-start gap-3 px-2.5 py-2 text-sm text-muted-foreground", collapsed && "justify-center")}>
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {!collapsed ? (
              <span className="flex flex-col items-start">
                <span>Didn&apos;t load</span>
                {group.retry ? (
                  <button
                    type="button"
                    onClick={group.retry}
                    className="rounded-detail font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Try again
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>,
        )
      ) : (
        <ul className="flex flex-col gap-0.5">
          {group.sections.map((section) => {
            const active = section.path === currentPath;
            const Icon = SETTINGS_SECTION_ICONS[section.id] ?? Settings;
            const content = (
              <span className={rowClass(active, collapsed)}>
                <ActiveMark active={active} />
                <Icon className="size-4 shrink-0" />
                {!collapsed ? <span className="flex-1 truncate">{section.label}</span> : null}
              </span>
            );
            const label = collapsed ? section.label : undefined;
            const sameApp = basePath !== "" && section.path.startsWith(`${basePath}/`);
            const link = sameApp ? (
              <Link href={section.path.slice(basePath.length)} aria-label={label} aria-current={active ? "page" : undefined}>
                {content}
              </Link>
            ) : (
              // Another module, or the shell: a document load, as with the module switcher.
              <a href={section.path} aria-label={label} aria-current={active ? "page" : undefined}>
                {content}
              </a>
            );
            return <li key={section.path}>{withTooltip(collapsed, section.label, link)}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
