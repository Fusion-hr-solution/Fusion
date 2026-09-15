import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { InvitationWordmark } from "./invitation-transaction";

export interface InvitationContextRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

/**
 * The invitation as an orientation, not a form: who invited the recipient, into
 * which organization, with which access, sent to which address. Each fact is
 * stated once, plainly, so the recipient can check the invitation is theirs
 * before choosing a password on the other half of the split.
 *
 * Prop-driven and data-agnostic — every invitation purpose (tenant activation,
 * an administrator invitation, workforce access) supplies its own words and
 * rows, so the composition stays identical while the copy stays with its
 * journey.
 */
export function InvitationContextPanel({
  eyebrow,
  heading,
  lead,
  rows,
  securityNote,
  footerLabel,
}: {
  /** The small uppercase line above the heading, e.g. "You're invited". */
  eyebrow: string;
  /** The hero line — the organization is the fact the recipient is checking. */
  heading: string;
  /** One sentence under the heading. */
  lead: string;
  /** The invitation facts, one per row. */
  rows: InvitationContextRow[];
  /** The reassurance that this link is tied to the invited address. */
  securityNote: string;
  /** Optional quiet footer line, shown only on wide layouts. */
  footerLabel?: string;
}) {
  return (
    <div className="mx-auto flex h-full max-w-[34rem] flex-col lg:max-w-[33rem]">
      <InvitationWordmark />

      <div className="mt-8 lg:mt-10">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-primary/90">
          {eyebrow}
        </p>
        <h1 className="mt-3 break-words font-editorial text-[2.25rem] font-medium leading-[1.05] tracking-[-0.02em] lg:text-[2.75rem]">
          {heading}
        </h1>
        <p className="mt-3 max-w-[44ch] text-[0.9375rem] leading-6 text-muted-foreground lg:text-base">
          {lead}
        </p>
      </div>

      <dl className="mt-8 divide-y divide-white/[0.07] overflow-hidden rounded-surface border border-white/[0.09] bg-white/[0.02]">
        {rows.map((row) => (
          <ContextRow
            key={row.label}
            icon={row.icon}
            label={row.label}
            value={row.value}
          />
        ))}
      </dl>

      <p className="mt-5 flex items-start gap-2.5 text-[0.8125rem] leading-6 text-muted-foreground">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span className="max-w-[46ch]">{securityNote}</span>
      </p>

      {footerLabel ? (
        <div className="mt-auto hidden items-center gap-3 pt-10 lg:flex">
          <span className="h-px w-8 bg-white/25" />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {footerLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-object bg-white/[0.05] text-muted-foreground ring-1 ring-inset ring-white/[0.08]">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </dt>
        <dd
          title={value}
          className="mt-0.5 truncate text-[0.9375rem] font-medium text-foreground"
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
