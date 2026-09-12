"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TenantAdministratorDto } from "@repo/api";
import { canManageTenantAdministration, canViewTenantAdministration, useAuth } from "@repo/auth";
import { Button, Input, Sheet, SheetContent, SheetTitle, cn } from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import { ArrowRight, Inbox, Search, UserRoundPlus, UserX } from "lucide-react";
import { toast } from "sonner";
import { AccessPageSkeleton } from "@/shell/route-skeletons";
import {
  useAdministratorInvitations,
  useRemovedAdministrators,
  useTenantAccessSummary,
  useTenantAdministrators,
} from "../api/use-tenant-access";
import {
  AdministratorTable,
  EmptyStateCard,
  InvitationsTable,
  RemovedTable,
  SectionHeading,
} from "./access-tables";
import { AdministratorDetail } from "./administrator-detail";
import { ContinuityBanner } from "./continuity-banner";
import { InviteAdministratorDialog } from "./invite-administrator-dialog";

/** Master-detail from `xl`; the detail slides in as a sheet on narrower screens. */
function useIsWide() {
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const sync = () => setIsWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return isWide;
}

function includesQuery(query: string, ...fields: string[]) {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return fields.some((field) => field.toLowerCase().includes(needle));
}

export default function AccessWorkspace() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isWide = useIsWide();

  const canView = canViewTenantAdministration(user);
  const canManage = canManageTenantAdministration(user);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [view, setView] = useState<"current" | "removed">("current");

  const summary = useTenantAccessSummary(canView);
  const administrators = useTenantAdministrators(canView);
  const invitations = useAdministratorInvitations(false, canView);
  const removed = useRemovedAdministrators(canView);

  // Re-read from the authoritative list so the panel never renders a snapshot
  // taken before the last mutation.
  const selected = useMemo<TenantAdministratorDto | null>(
    () => administrators.data?.find((item) => item.membershipId === selectedId) ?? null,
    [administrators.data, selectedId]
  );

  // On first load, open the current administrator's own record in the detail
  // panel — the person is nearly always here to act on their own access. Runs
  // once, only on wide layouts (auto-opening a sheet on a phone would be
  // intrusive), and never fights a later manual close.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || !isWide || selectedId) return;
    const me = administrators.data?.find((item) => item.userId === user?.userId);
    if (me) {
      setSelectedId(me.membershipId);
      autoSelected.current = true;
    }
  }, [isWide, administrators.data, user?.userId, selectedId]);

  // One coherent load: hold the whole page as a layout-shaped skeleton until the
  // above-the-fold data (posture + roster) has resolved, then swap to the full
  // page in a single step. Refetches never hit this (react-query keeps prior
  // data), so the page does not flash back to skeletons after the first load.
  const isInitialLoading =
    isAuthLoading ||
    (canView &&
      (summary.isLoading ||
        administrators.isLoading ||
        invitations.isLoading ||
        removed.isLoading));

  if (isInitialLoading) {
    return <AccessPageSkeleton />;
  }

  if (!canView) {
    return (
      <PageContainer width="wide" className="max-w-4xl space-y-6">
        <PageHeader title="Administrators" />
        <PagePermissionNotice
          title="You do not have access to this page"
          description="Ask an administrator if you need to manage who administers this tenant."
        />
      </PageContainer>
    );
  }

  const rows = administrators.data ?? [];
  const active = rows
    .filter((item) => item.status === "Active")
    .filter((item) => includesQuery(search, item.name, item.email));
  const suspended = rows
    .filter((item) => item.status === "Suspended")
    .filter((item) => includesQuery(search, item.name, item.email));
  const pending = (invitations.data ?? []).filter((item) => includesQuery(search, item.email));
  const removedRows = (removed.data ?? []).filter((item) =>
    includesQuery(search, item.name, item.email)
  );

  const detail = selected ? (
    <AdministratorDetail
      administrator={selected}
      currentUserId={user?.userId ?? null}
      canManage={canManage}
      onClose={() => setSelectedId(null)}
      onSelfRemoved={() => {
        setSelectedId(null);
        toast.success("You no longer administer this tenant.");
        router.replace("/");
      }}
      onChanged={(message) => toast.success(message)}
    />
  ) : null;

  return (
    <PageContainer width="wide" className="space-y-8">
      <PageHeader
        eyebrow={<span className="type-eyebrow text-primary">Tenant administration</span>}
        title="Administrators"
        description="Manage who can administer this tenant. Invite, suspend, or remove administrator access."
        actions={
          <Button asChild variant="outline">
            <Link href="/access/activity">
              View activity log
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      {summary.data ? (
        <ContinuityBanner
          summary={summary.data}
          canManage={canManage}
          onInvite={() => setInviteOpen(true)}
        />
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <div className="flex flex-col gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Administrator views" className="flex gap-5">
              <ViewTab active={view === "current"} onClick={() => setView("current")}>
                Administrators
              </ViewTab>
              <ViewTab
                active={view === "removed"}
                onClick={() => setView("removed")}
                count={(removed.data ?? []).length}
              >
                Removed
              </ViewTab>
            </div>

            <div className="sm:w-72 sm:pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={view === "removed" ? "Search removed…" : "Search administrators…"}
                  className="pl-9"
                  aria-label="Search"
                />
              </div>
            </div>
          </div>

          {view === "current" ? (
            <div className="space-y-8">
              <section className="space-y-3">
                <SectionHeading title="Active administrators" count={active.length} />
                {administrators.isLoading ? (
                  <PageSkeleton rows={3} width="wide" label="Loading administrators" />
                ) : administrators.error !== null ? (
                  <SectionFailure
                    label="administrators"
                    onRetry={() => void administrators.refetch()}
                  />
                ) : active.length > 0 ? (
                  <AdministratorTable
                    administrators={active}
                    currentUserId={user?.userId ?? null}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ) : (
                  <EmptyStateCard
                    icon={<UserX className="size-5" />}
                    title="No active administrators"
                    hint="No one can administer this tenant right now."
                  />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeading title="Pending invitations" count={pending.length} />
                {invitations.isLoading ? (
                  <PageSkeleton rows={3} width="wide" label="Loading invitations" />
                ) : invitations.error !== null ? (
                  <SectionFailure label="invitations" onRetry={() => void invitations.refetch()} />
                ) : pending.length > 0 ? (
                  <InvitationsTable invitations={pending} canManage={canManage} />
                ) : (
                  <EmptyStateCard
                    icon={<Inbox className="size-5" />}
                    title="No pending invitations"
                    hint={canManage ? "Invite an administrator to see it here." : undefined}
                  />
                )}
              </section>

              <section className="space-y-3">
                <SectionHeading title="Suspended administrators" count={suspended.length} />
                {administrators.isLoading ? (
                  <PageSkeleton rows={2} width="wide" label="Loading administrators" />
                ) : administrators.error !== null ? null : suspended.length > 0 ? (
                  <AdministratorTable
                    administrators={suspended}
                    currentUserId={user?.userId ?? null}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ) : (
                  <EmptyStateCard
                    icon={<UserX className="size-5" />}
                    title="No suspended administrators"
                    hint="Suspended administrators will appear here."
                  />
                )}
              </section>
            </div>
          ) : (
            <section className="space-y-3">
              {removed.isLoading ? (
                <PageSkeleton rows={4} width="wide" label="Loading removed administrators" />
              ) : removed.error !== null ? (
                <SectionFailure
                  label="removed administrators"
                  onRetry={() => void removed.refetch()}
                />
              ) : removedRows.length > 0 ? (
                <RemovedTable removed={removedRows} />
              ) : (
                <EmptyStateCard
                  icon={<UserRoundPlus className="size-5" />}
                  title="No removed administrators"
                  hint="Administrators whose access was removed will appear here."
                />
              )}
            </section>
          )}
        </div>

        {isWide ? (
          <aside aria-label="Administrator details">
            <div className="sticky top-6 overflow-hidden rounded-2xl border bg-card">
              {detail ?? <DetailPlaceholder />}
            </div>
          </aside>
        ) : null}
      </div>

      {!isWide ? (
        <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm">
            <SheetTitle className="sr-only">Administrator details</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      ) : null}

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
    </PageContainer>
  );
}

function ViewTab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {typeof count === "number" ? (
        <span className="type-meta tabular-nums text-muted-foreground">({count})</span>
      ) : null}
    </button>
  );
}

function DetailPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span aria-hidden className="text-muted-foreground/50">
        <UserRoundPlus className="size-9" strokeWidth={1.5} />
      </span>
      <p className="type-label text-foreground">No administrator selected</p>
      <p className="max-w-[24ch] type-meta text-muted-foreground">
        Select an administrator to view their access and manage it.
      </p>
    </div>
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
