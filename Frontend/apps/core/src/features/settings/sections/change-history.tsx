"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { AccessAuditEventDto, FusionSettingsSection, SettingsAuditEventDto } from "@repo/api";
import { cn, NativeSelect, NativeSelectOption } from "@repo/ds";
import { formatDate, formatTime } from "@repo/ds/lib/dates";
import { PageError, SettingsPage } from "@repo/ds/shell";
import { useAccessAudit } from "@/features/access/api/use-core-access";
import { useSettingsAudit } from "@/features/settings/api/use-tenant-settings";
import { AUDIT_SECTION_LABELS } from "@/features/settings/core-settings";

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Work email",
  hireDate: "Hire date",
  phone: "Phone",
  jobTitle: "Job title",
  workLocation: "Work location",
  employmentType: "Employment type",
};

const AUDIENCE: Record<string, { label: string; who: string }> = {
  visibleToManager: { label: "their manager", who: "managers" },
  visibleToEmployee: { label: "the employee", who: "employees" },
};

/** One before → after line of a change, in the words its page uses. */
export interface ChangeLine {
  label: string;
  before: string;
  after: string;
  /** The change as a sentence, for the entry's headline. */
  sentence: string;
}

export interface HistoryEntry {
  id: string;
  at: Date;
  actor: string;
  section: string;
  headline: string;
  lines: ChangeLine[];
}

function flatten(value: unknown, prefix = "", into: Record<string, unknown> = {}): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, into);
  } else if (prefix) {
    into[prefix] = value;
  }
  return into;
}

function parse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const IGNORED = /(^|\.)(version|downstreamConsumers|usesDefaultBranding|displayName|locale|timeZone|visible)$/;

/** A changed value, described the way Settings shows it. */
export function describeChange(path: string, before: unknown, after: unknown): ChangeLine {
  const field = /employeeFieldConfig\.(\w+)\.(\w+)$/.exec(path);
  if (field) {
    const name = FIELD_LABELS[field[1]!] ?? field[1]!;
    const audience = AUDIENCE[field[2]!];
    if (audience) {
      const seen = (value: unknown) => (value ? "Sees it" : "Hidden");
      return {
        label: `${name} · ${audience.label}`,
        before: seen(before),
        after: seen(after),
        sentence: `${name}: ${audience.who} ${after ? "now see it" : "no longer see it"}`,
      };
    }
    if (field[2] === "required") {
      const yes = (value: unknown) => (value ? "Required" : "Optional");
      return { label: `${name} · required`, before: yes(before), after: yes(after), sentence: `${name}: now ${after ? "required" : "optional"}` };
    }
  }
  const self = /selfService\.canEdit(\w+)$/.exec(path);
  if (self) {
    const what = self[1] === "Phone" ? "phone number" : "preferred name";
    const can = (value: unknown) => (value ? "Yes" : "No");
    return {
      label: `Employees change their ${what}`,
      before: can(before),
      after: can(after),
      sentence: after ? `Employees can change their ${what}` : `Employees can no longer change their ${what}`,
    };
  }
  if (path.endsWith("inviteExpiryDays"))
    return { label: "Invitation expires after", before: `${before} days`, after: `${after} days`, sentence: `Expiry from ${before} to ${after} days` };
  if (path.endsWith("resendCooldownHours"))
    return {
      label: "People can ask for a new one after",
      before: `${before} hours`,
      after: `${after} hours`,
      sentence: `New link wait from ${before} to ${after} hours`,
    };
  if (path.endsWith("pendingInviteBehavior")) {
    const name = (value: unknown) => (value === "KeepExisting" ? "Keep the first one" : "Send a fresh one");
    return { label: "Inviting someone again", before: name(before), after: name(after), sentence: `Inviting someone again: ${name(after).toLowerCase()}` };
  }
  if (path.endsWith("defaultAccessProfileId"))
    return { label: "Role for new accounts", before: before ? "A chosen role" : "Employee", after: after ? "A chosen role" : "Employee", sentence: "Role for new accounts changed" };
  const text = (value: unknown) => (value === null || value === undefined || value === "" ? "None" : String(value));
  return { label: path.split(".").pop() ?? path, before: text(before), after: text(after), sentence: `${path.split(".").pop()} changed` };
}

/** The values a settings entry changed, as lines. */
export function changeLines(beforeJson: string | null, afterJson: string | null): ChangeLine[] {
  const before = flatten(parse(beforeJson));
  const after = flatten(parse(afterJson));
  return Object.keys({ ...before, ...after })
    .filter((path) => !IGNORED.test(path) && JSON.stringify(before[path]) !== JSON.stringify(after[path]))
    .map((path) => describeChange(path, before[path], after[path]));
}

function fromSettings(entry: SettingsAuditEventDto): HistoryEntry {
  const lines = changeLines(entry.beforeJson, entry.afterJson);
  return {
    id: `settings:${entry.id}`,
    at: new Date(entry.occurredAt),
    actor: entry.actorName && entry.actorName !== "Unknown" ? entry.actorName : "Someone",
    section: AUDIT_SECTION_LABELS[entry.sectionId] ?? entry.sectionId,
    headline: lines[0] ? (lines.length > 1 ? `${lines[0].sentence}, and ${lines.length - 1} more` : lines[0].sentence) : entry.summary,
    lines,
  };
}

function fromAccess(entry: AccessAuditEventDto): HistoryEntry {
  return {
    id: `access:${entry.id}`,
    at: new Date(entry.occurredAt),
    actor: entry.actorName && entry.actorName !== "Unknown" ? entry.actorName : "Someone",
    section: "Roles",
    headline: entry.summary,
    lines: [],
  };
}

/** The access log also records invitations and administrators; Roles shows role definitions and who holds them. */
export function isRoleChange(entry: Pick<AccessAuditEventDto, "action">): boolean {
  return /^access\.(profile|assignment)\./.test(entry.action);
}

/** "This week", then each month ("October", "October 2025" outside this year), newest first. */
export function periodOf(at: Date, now: Date = new Date()): string {
  if (now.getTime() - at.getTime() < 7 * 86_400_000) return "This week";
  const month = at.toLocaleString("en-GB", { month: "long" });
  return at.getFullYear() === now.getFullYear() ? month : `${month} ${at.getFullYear()}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? "").slice(0, 2)) || "?").toUpperCase();
}

function Entry({ entry, thisWeek }: { entry: HistoryEntry; thisWeek: boolean }) {
  const [open, setOpen] = useState(false);
  const openable = entry.lines.length > 0;
  const when = thisWeek ? `${formatDate(entry.at, { weekday: true }).split(" ")[0]} ${formatTime(entry.at)}` : formatDate(entry.at);
  const body = (
    <>
      <span className="w-[72px] shrink-0 whitespace-nowrap pt-0.5 type-meta tabular-nums text-muted-foreground">{when}</span>
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-inlay text-[10px] font-semibold text-foreground/85 ring-1 ring-border"
      >
        {initials(entry.actor)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-label font-semibold text-foreground">{entry.actor}</span>
          <span className="rounded-control bg-inlay px-1.5 py-0.5 type-meta text-muted-foreground">{entry.section}</span>
        </span>
        <span className="text-sm text-foreground/90">{entry.headline}</span>
        {open ? (
          <span className="mt-1 flex flex-col gap-1">
            {entry.lines.map((line) => (
              <span key={line.label} className="flex flex-wrap items-baseline gap-2 type-meta">
                <span className="text-muted-foreground">{line.label}</span>
                <span className="text-muted-foreground line-through">{line.before}</span>
                <span aria-hidden className="text-muted-foreground">→</span>
                <span className="sr-only">changed to</span>
                <span className="font-semibold text-foreground">{line.after}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {openable ? (
        <ChevronRight aria-hidden className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
      ) : null}
    </>
  );
  return (
    <li>
      {openable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "flex w-full items-start gap-3 rounded-surface px-4 py-3 text-left outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
            open && "bg-card"
          )}
        >
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  );
}

/** Settings › Change history: every Core HR settings change, newest first. Read-only for everyone. */
export function ChangeHistorySettings({ section }: { section: FusionSettingsSection }) {
  const settings = useSettingsAudit();
  const access = useAccessAudit();
  const [sectionFilter, setSectionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");

  const entries = useMemo(
    () =>
      [...(settings.data ?? []).map(fromSettings), ...(access.data ?? []).filter(isRoleChange).map(fromAccess)].sort(
        (a, b) => b.at.getTime() - a.at.getTime()
      ),
    [settings.data, access.data]
  );
  const sections = useMemo(() => [...new Set(entries.map((entry) => entry.section))].sort(), [entries]);
  const actors = useMemo(() => [...new Set(entries.map((entry) => entry.actor))].sort(), [entries]);
  const shown = entries.filter(
    (entry) => (!sectionFilter || entry.section === sectionFilter) && (!actorFilter || entry.actor === actorFilter)
  );
  const now = new Date();
  const periods = shown.reduce<{ period: string; entries: HistoryEntry[] }[]>((groups, entry) => {
    const period = periodOf(entry.at, now);
    const last = groups[groups.length - 1];
    if (last?.period === period) last.entries.push(entry);
    else groups.push({ period, entries: [entry] });
    return groups;
  }, []);

  if (settings.error && !settings.data) {
    return (
      <SettingsPage title={section.label}>
        <PageError title="Change history didn't load" onRetry={() => void settings.refetch()} />
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title={section.label} loading={settings.isLoading}>
      <div className="flex flex-wrap gap-2">
        <NativeSelect aria-label="Section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} size="sm">
          <NativeSelectOption value="">All sections</NativeSelectOption>
          {sections.map((name) => (
            <NativeSelectOption key={name} value={name}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Person" value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} size="sm">
          <NativeSelectOption value="">Anyone</NativeSelectOption>
          {actors.map((name) => (
            <NativeSelectOption key={name} value={name}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {entries.length === 0 ? (
        <p className="type-body-secondary text-muted-foreground">No settings have changed yet.</p>
      ) : shown.length === 0 ? (
        <p className="type-body-secondary text-muted-foreground">
          No changes match.{" "}
          <button
            type="button"
            className="font-semibold text-foreground hover:underline"
            onClick={() => {
              setSectionFilter("");
              setActorFilter("");
            }}
          >
            Clear filters
          </button>
        </p>
      ) : (
        periods.map((group) => (
          <section key={group.period} aria-label={group.period} className="flex flex-col gap-1">
            <h2 className="type-subsection-title">{group.period}</h2>
            <ul className="-mx-4 flex flex-col">
              {group.entries.map((entry) => (
                <Entry key={entry.id} entry={entry} thisWeek={group.period === "This week"} />
              ))}
            </ul>
          </section>
        ))
      )}
    </SettingsPage>
  );
}
