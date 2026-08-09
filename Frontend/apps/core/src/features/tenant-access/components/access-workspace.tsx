"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AccessActivityItemDto,
  ContinuityState,
  TenantAccessSummaryDto,
  TenantAdministratorDto,
} from "@repo/api";
import { canManageTenantAdministration, canViewTenantAdministration, useAuth } from "@repo/auth";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, Button } from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
  StatusBadge,
} from "@repo/ds/shell";
import { toast } from "sonner";
import {
  useAdministratorInvitations,
  useRecentAccessActivity,
  useTenantAccessSummary,
  useTenantAdministrators,
} from "../api/use-tenant-access";
import {
  ACTIVITY_LABEL,
  ADMINISTRATOR_STATUS_LABEL,
  ADMINISTRATOR_STATUS_TONE,
  CONTINUITY_ADVISORY,
  CONTINUITY_LABEL,
  CONTINUITY_TONE,
  COPY,
  actorLabel,
  formatDay,
  formatMoment,
} from "./access-language";
import { IdentityMark, StatusMark, initialsOf } from "./access-ui";
import { AdministratorPanel } from "./administrator-panel";
import { InvitationRow } from "./invitation-row";
import { InviteAdministratorDialog } from "./invite-administrator-dialog";

/**
 * Access — who can administer this tenant.
 *
 * The page opens with the one thing the list cannot show: whether the tenant is
 * safely administered. Continuity is computed by the service, so an administrator
 * reads a posture rather than inferring it from counting rows. Below it, the
 * people themselves — administrators and outstanding invitations in one place,
 * because "who can administer this tenant" has to be answerable at a glance.
 */
export default function AccessWorkspace() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const canView = canViewTenantAdministration(user);
  const canManage = canManageTenantAdministration(user);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const summary = useTenantAccessSummary(canView);
  const administrators = useTenantAdministrators(canView);
  const invitations = useAdministratorInvitations(false, canView);
  const activity = useRecentAccessActivity(canView);

  // Re-read from the authoritative list so the panel never renders a snapshot
  // taken before the last mutation.
  const selected = useMemo(
    () =>
      administrators.data?.find((item) => item.membershipId === selectedId) ?? null,
    [administrators.data, selectedId]
  );

  if (isAuthLoading) {
    return <PageSkeleton rows={6} width="wide" label="Loading access" />;
  }

  if (!canView) {
    return (
      <PageContainer width="wide" className="max-w-4xl space-y-6">
        <PageHeader title="Access" />
        <PagePermissionNotice
          title="You do not have access to this page"
          description="Ask an administrator if you need to manage access for this tenant."
        />
      </PageContainer>
    );
  }

  const isLoading = administrators.isLoading || invitations.isLoading;
  const rows = administrators.data ?? [];
  const pending = invitations.data ?? [];
  const activeAdministrators = rows.filter((item) => item.status === "Active");

  return (
    // A short roster of administrators is configuration, not a dense workbench:
    // a focused column keeps each person's identity, state, and action reading as
    // one row and sits the primary action directly above them.
    <PageContainer width="wide" className="max-w-4xl space-y-8">
      <PageHeader
        eyebrow={
          summary.data ? (
            <span className="type-eyebrow text-muted-foreground">{summary.data.tenantName}</span>
          ) : undefined
        }
        title="Access"
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)}>Invite administrator</Button>
          ) : undefined
        }
      />

      {summary.data ? (
        <ContinuitySpine
          summary={summary.data}
          activeAdministrators={activeAdministrators}
          canManage={canManage}
          onInvite={() => setInviteOpen(true)}
        />
      ) : null}

      {/* The header and continuity posture already name this as administrator
          access; a third visible heading on the primary content would only
          repeat it. It stays for assistive technology and steps out of the
          visual stack so the people lead. */}
      <section aria-labelledby="administrator-access-heading" className="space-y-3">
        <h2 id="administrator-access-heading" className="sr-only">
          Administrator access
        </h2>

        {isLoading ? (
          <PageSkeleton rows={4} width="wide" label="Loading administrators" />
        ) : administrators.error !== null ? (
          <SectionFailure label="administrators" onRetry={() => void administrators.refetch()} />
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border">
            {rows.map((administrator) => (
              <AdministratorRow
                key={administrator.membershipId}
                administrator={administrator}
                isSelf={administrator.userId === user?.userId}
                onManage={() => setSelectedId(administrator.membershipId)}
              />
            ))}

            {pending.map((invitation) => (
              <InvitationRow
                key={invitation.invitationId}
                invitation={invitation}
                canManage={canManage}
                onChanged={(message) => toast.success(message)}
              />
            ))}

            {rows.length === 0 && pending.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-8">
                <p className="type-body text-muted-foreground">{COPY.noAdministrators}</p>
                {canManage ? (
                  <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
                    Invite administrator
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {invitations.error !== null ? (
          <SectionFailure label="invitations" onRetry={() => void invitations.refetch()} />
        ) : null}
      </section>

      <RecentActivity
        items={activity.data ?? []}
        failed={activity.error !== null}
        onRetry={() => void activity.refetch()}
      />

      <InviteAdministratorDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={(email, deliveryFailed) =>
          toast.success(
            deliveryFailed
              ? `Invitation created for ${email}, but the email could not be delivered. Resend it.`
              : `Invitation sent to ${email}.`
          )
        }
      />

      <AdministratorPanel
        administrator={selected}
        currentUserId={user?.userId ?? null}
        canManage={canManage}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onInviteAnother={() => {
          setSelectedId(null);
          setInviteOpen(true);
        }}
        onSelfRemoved={() => {
          setSelectedId(null);
          toast.success("You no longer administer this tenant.");
          router.replace("/");
        }}
        onChanged={(message) => toast.success(message)}
      />
    </PageContainer>
  );
}

const ADVISORY_SURFACE: Partial<Record<ContinuityState, string>> = {
  AtRisk: "border-warning/35 bg-warning-subtle",
  RecoveryRequired: "border-destructive/35 bg-destructive/10",
};

/**
 * The page's opening statement: the tenant's active administrators as faces, the
 * count as a figure, and the service's continuity judgment as a semantic posture.
 * When that posture needs attention it says so once, with the recovery path
 * attached — otherwise it stays calm and simply confirms the tenant is covered.
 */
function ContinuitySpine({
  summary,
  activeAdministrators,
  canManage,
  onInvite,
}: {
  summary: TenantAccessSummaryDto;
  activeAdministrators: TenantAdministratorDto[];
  canManage: boolean;
  onInvite: () => void;
}) {
  const advisory = CONTINUITY_ADVISORY[summary.continuity];
  const shown = activeAdministrators.slice(0, 5);
  const overflow = Math.max(summary.activeAdministrators - shown.length, 0);

  const meta: string[] = [];
  if (summary.suspendedAdministrators > 0) {
    meta.push(`${summary.suspendedAdministrators} suspended`);
  }
  if (summary.pendingInvitations > 0) {
    meta.push(`${summary.pendingInvitations} invited`);
  }

  return (
    <section aria-label="Administrative continuity" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {shown.length > 0 ? (
          <AvatarGroup>
            {shown.map((administrator) => (
              <Avatar key={administrator.membershipId} size="lg">
                <AvatarFallback className="type-label bg-muted text-muted-foreground">
                  {initialsOf(administrator.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflow > 0 ? <AvatarGroupCount>+{overflow}</AvatarGroupCount> : null}
          </AvatarGroup>
        ) : null}

        <div className="flex items-baseline gap-2">
          <span className="type-metric text-foreground">{summary.activeAdministrators}</span>
          <span className="type-body text-muted-foreground">
            {summary.activeAdministrators === 1 ? "administrator" : "administrators"}
          </span>
        </div>

        <StatusBadge tone={CONTINUITY_TONE[summary.continuity]} dot>
          {CONTINUITY_LABEL[summary.continuity]}
        </StatusBadge>

        {meta.length > 0 ? (
          <span className="type-meta text-muted-foreground">{meta.join(" · ")}</span>
        ) : null}
      </div>

      {advisory ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            ADVISORY_SURFACE[summary.continuity] ?? ""
          }`}
        >
          <p className="type-body min-w-0 text-foreground">{advisory}</p>
          {canManage ? (
            <Button size="sm" onClick={onInvite}>
              Invite administrator
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function AdministratorRow({
  administrator,
  isSelf,
  onManage,
}: {
  administrator: TenantAdministratorDto;
  isSelf: boolean;
  onManage: () => void;
}) {
  return (
    <div className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40">
      <IdentityMark name={administrator.name} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="type-label truncate text-foreground">{administrator.name}</p>
          {isSelf ? (
            <span className="type-meta shrink-0 rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
              You
            </span>
          ) : null}
        </div>
        <p className="truncate type-meta text-muted-foreground">{administrator.email}</p>
        <div className="mt-1.5 sm:hidden">
          <StatusMark tone={ADMINISTRATOR_STATUS_TONE[administrator.status]}>
            {ADMINISTRATOR_STATUS_LABEL[administrator.status]}
          </StatusMark>
        </div>
      </div>

      <div className="hidden w-32 shrink-0 sm:block">
        <StatusMark tone={ADMINISTRATOR_STATUS_TONE[administrator.status]}>
          {ADMINISTRATOR_STATUS_LABEL[administrator.status]}
        </StatusMark>
      </div>

      <p className="hidden w-40 shrink-0 type-meta whitespace-nowrap text-muted-foreground lg:block">
        Since {formatDay(administrator.accessEstablishedAt)}
      </p>

      {/* Fixed width only where there is room for it: reserving the column on a
          phone steals the space the person's name needs. */}
      <div className="flex shrink-0 justify-end lg:w-28">
        <Button variant="outline" size="sm" onClick={onManage}>
          Manage
        </Button>
      </div>
    </div>
  );
}

/**
 * Supporting information, kept subordinate: a quiet timeline whose connective
 * rail gives the feed structure without letting it compete with the roster above.
 */
function RecentActivity({
  items,
  failed,
  onRetry,
}: {
  items: AccessActivityItemDto[];
  failed: boolean;
  onRetry: () => void;
}) {
  const visible = items.slice(0, 5);

  return (
    <section aria-labelledby="recent-activity-heading" className="space-y-3">
      <h2 id="recent-activity-heading" className="type-eyebrow text-muted-foreground">
        Recent activity
      </h2>

      {failed ? (
        <SectionFailure label="activity" onRetry={onRetry} />
      ) : visible.length === 0 ? (
        <p className="type-meta text-muted-foreground">{COPY.noActivity}</p>
      ) : (
        <ul>
          {visible.map((item, index) => {
            const actor = actorLabel(item.actorName);
            const isLast = index === visible.length - 1;
            return (
              <li key={item.id} className="flex gap-3">
                <div aria-hidden className="flex flex-col items-center">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full border-2 border-muted-foreground/40 bg-background" />
                  {isLast ? null : <span className="w-px flex-1 bg-border" />}
                </div>
                <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 pb-4">
                  <p className="type-body text-foreground">
                    {ACTIVITY_LABEL[item.action] ?? item.summary}
                    {actor ? <span className="text-muted-foreground"> · by {actor}</span> : null}
                  </p>
                  <p className="type-meta text-muted-foreground">{formatMoment(item.occurredAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One section failing does not take the page with it, and it offers its own retry. */
function SectionFailure({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
      <p className="type-body text-muted-foreground">The {label} could not be loaded.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
