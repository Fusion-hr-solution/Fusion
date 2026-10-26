"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createPlatformApiClient,
  tenantAccessPaths,
  type AccessActivityItemDto,
  type AccessActivityPageDto,
} from "@repo/api";
import { canViewTenantAdministration, useAuth } from "@repo/auth";
import { Button } from "@repo/ds";
import { PageContainer, PageHeader, PagePermissionNotice } from "@repo/ds/shell";
import { ArrowLeft } from "lucide-react";
import { ActivityLogPageSkeleton } from "@/shell/route-skeletons";
import { actorLabel, useAccessWords } from "./access-language";

const PAGE_SIZE = 30;

type Cursor = { occurredAt: string; id: string } | null;

/**
 * The full record of access administration — the destination behind the roster's
 * "View activity log". A keyset-paged feed rather than a table: the reader is
 * following a sequence of events, not comparing rows across columns.
 */
export default function ActivityLogWorkspace() {
  const t = useTranslations("admins");
  const { user, isLoading: isAuthLoading } = useAuth();
  const canView = canViewTenantAdministration(user);
  const client = useMemo(() => createPlatformApiClient(), []);

  const [items, setItems] = useState<AccessActivityItemDto[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (from: Cursor, append: boolean) => {
      if (append) setLoadingMore(true);
      else setStatus("loading");

      try {
        const page = await client.get<AccessActivityPageDto>(tenantAccessPaths.activity(), {
          params: {
            pageSize: PAGE_SIZE,
            cursorOccurredAt: from?.occurredAt,
            cursorId: from?.id,
          },
        });

        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setCursor(
          page.nextCursorOccurredAt && page.nextCursorId
            ? { occurredAt: page.nextCursorOccurredAt, id: page.nextCursorId }
            : null
        );
        setStatus("ready");
      } catch {
        setStatus("error");
      } finally {
        setLoadingMore(false);
      }
    },
    [client]
  );

  useEffect(() => {
    if (canView) void load(null, false);
  }, [canView, load]);

  if (isAuthLoading) {
    return <ActivityLogPageSkeleton />;
  }

  if (!canView) {
    return (
      <PageContainer width="wide" className="max-w-3xl space-y-6">
        <PageHeader title={t("log.title")} />
        <PagePermissionNotice
          title={t("denied.title")}
          description={t("log.denied")}
        />
      </PageContainer>
    );
  }

  if (status === "idle" || status === "loading") {
    return <ActivityLogPageSkeleton />;
  }

  return (
    <PageContainer width="wide" className="max-w-3xl space-y-8">
      <PageHeader
        eyebrow={
          <Link
            href="/access"
            className="inline-flex items-center gap-1.5 type-eyebrow text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("title")}
          </Link>
        }
        title={t("log.title")}
        description={t("log.description")}
      />

      {status === "error" && items.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-surface border px-4 py-3">
          <p className="type-body text-muted-foreground">{t("log.failed")}</p>
          <Button variant="outline" size="sm" onClick={() => void load(null, false)}>
            {t("retry")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="type-body text-muted-foreground">{t("log.empty")}</p>
      ) : (
        <>
          <ol className="border-s">
            {items.map((item) => (
              <ActivityEntry key={item.id} item={item} />
            ))}
          </ol>

          {cursor ? (
            <div className="flex justify-center">
              <Button variant="outline" disabled={loadingMore} onClick={() => void load(cursor, true)}>
                {loadingMore ? t("log.loading") : t("log.more")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}

function ActivityEntry({ item }: { item: AccessActivityItemDto }) {
  const t = useTranslations("admins");
  const words = useAccessWords();
  const actor = actorLabel(item.actorName);

  return (
    <li className="relative py-3 ps-6">
      <span
        aria-hidden
        className="absolute -inset-s-[5px] top-4 size-2 rounded-full border-2 border-muted-foreground/40 bg-background"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="type-body text-foreground">
          {words.activity(item.action, item.summary)}
          {actor ? <span className="text-muted-foreground">{t("log.by", { actor })}</span> : null}
        </p>
        <p className="type-meta whitespace-nowrap text-muted-foreground">
          {words.moment(item.occurredAt)}
        </p>
      </div>
      {words.knowsActivity(item.action) && item.summary ? (
        <p className="mt-0.5 type-meta text-muted-foreground">{item.summary}</p>
      ) : null}
    </li>
  );
}
