"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccessActivityItemDto, TenantAdministratorDto } from "@repo/api";
import { canManageTenantAdministration, canViewTenantAdministration, useAuth } from "@repo/auth";
import { Button } from "@repo/ds";
import { PageContainer, PageHeader, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
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
  COPY,
  actorLabel,
  formatDay,
  formatMoment,
} from "./access-language";
import { IdentityMark, StatusMark } from "./access-ui";
import { AdministratorPanel } from "./administrator-panel";
import { InvitationRow } from "./invitation-row";
import { InviteAdministratorDialog } from "./invite-administrator-dialog";

/**
 * Access — who can administer this tenant.
 *
 * `Access` is the durable destination; administrator access is the first thing
 * inside it. The page is a list, not a dashboard: counts, health scores, and
 * summary cards would restate what the rows already show, and none of them is
 * the reason anyone opens this page.
 *
 * Continuity is a safeguard, not the subject. It appears as one quiet word beside
 * the person it concerns, and becomes prominent only when it actually stops an
 * action.
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
      <PageContainer width="wide" className="space-y-6">
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

  // Quiet, and attached to the person it concerns rather than announced at the
  // top of the page: one usable administrator is a working tenant, just a
  // fragile one, and framing it as an alert would make a second invitation feel
  // like mandatory onboarding.
  const soleUsableId =
    summary.data?.usableAdministrators === 1
      ? rows.find((item) => item.isUsable)?.membershipId ?? null
      : null;

  return (
    <PageContainer width="wide" className="space-y-8">
      <PageHeader
        title="Access"
        description={COPY.pageDescription}
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)}>Invite administrator</Button>
          ) : undefined
        }
      />

      <section aria-labelledby="administrator-access-heading" className="space-y-3">
        <h2 id="administrator-access-heading" className="text-sm font-medium">
          Administrator access
        </h2>

        {isLoading ? (
          <PageSkeleton rows={4} width="wide" label="Loading administrators" />
        ) : administrators.error !== null ? (
          <SectionFailure label="administrators" onRetry={() => void administrators.refetch()} />
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border">
            {rows.map((administrator) => (
              <AdministratorRow
                key={administrator.membershipId}
                administrator={administrator}
                isSelf={administrator.userId === user?.userId}
                isSole={administrator.membershipId === soleUsableId}
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
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-6">
                <p className="text-sm text-muted-foreground">{COPY.noAdministrators}</p>
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

function AdministratorRow({
  administrator,
  isSelf,
  isSole,
  onManage,
}: {
  administrator: TenantAdministratorDto;
  isSelf: boolean;
  isSole: boolean;
  onManage: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <IdentityMark name={administrator.name} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {administrator.name}
          {isSelf ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">You</span>
          ) : null}
        </p>
        <p className="truncate text-sm text-muted-foreground">{administrator.email}</p>
        <div className="mt-1 sm:hidden">
          <StatusMark tone={ADMINISTRATOR_STATUS_TONE[administrator.status]}>
            {ADMINISTRATOR_STATUS_LABEL[administrator.status]}
          </StatusMark>
        </div>
      </div>

      <div className="hidden w-44 shrink-0 sm:block">
        <StatusMark tone={ADMINISTRATOR_STATUS_TONE[administrator.status]}>
          {ADMINISTRATOR_STATUS_LABEL[administrator.status]}
        </StatusMark>
        {isSole ? (
          <p className="mt-0.5 pl-3.5 text-sm text-muted-foreground">{COPY.soleAdministrator}</p>
        ) : null}
      </div>

      <p className="hidden w-40 shrink-0 whitespace-nowrap text-sm text-muted-foreground lg:block">
        Since {formatDay(administrator.accessEstablishedAt)}
      </p>

      {/* Fixed width only where there is room for it: reserving the column on a
          phone steals the space the person's name needs. */}
      <div className="flex shrink-0 justify-end lg:w-32">
        <Button variant="outline" size="sm" onClick={onManage}>
          Manage
        </Button>
      </div>
    </div>
  );
}

/**
 * Supporting information, and shaped to stay that way: same rows, smaller type,
 * no surface of its own, so it never competes with the list above it.
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
  return (
    <section aria-labelledby="recent-activity-heading" className="space-y-3">
      <h2 id="recent-activity-heading" className="text-sm font-medium text-muted-foreground">
        Recent activity
      </h2>

      {failed ? (
        <SectionFailure label="activity" onRetry={onRetry} />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{COPY.noActivity}</p>
      ) : (
        <ul className="divide-y border-t">
          {items.slice(0, 5).map((item) => {
            const actor = actorLabel(item.actorName);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <p className="text-sm">
                  {ACTIVITY_LABEL[item.action] ?? item.summary}
                  {actor ? (
                    <span className="text-muted-foreground"> · by {actor}</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">{formatMoment(item.occurredAt)}</p>
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <p className="text-sm text-muted-foreground">The {label} could not be loaded.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
