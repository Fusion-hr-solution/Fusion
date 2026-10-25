"use client";

import { useState } from "react";
import { Check, ChevronRight, Lock } from "lucide-react";
import { ApiError, type NotificationGroupKey, type NotificationPreferenceGroup } from "@repo/api";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@repo/api/query";
import { cn, Switch } from "@repo/ds";
import { FUSION_MODULE_ICONS, PageError, SettingsBlock, SettingsPage, SettingsSaved } from "@repo/ds/shell";

function Always() {
  return (
    <span className="inline-flex items-center gap-1.5 type-meta font-semibold text-muted-foreground">
      <Lock aria-hidden className="size-3.5" />
      Always
    </span>
  );
}

function GroupRow({
  group,
  saving,
  onEmailChange,
}: {
  group: NotificationPreferenceGroup;
  saving: boolean;
  onEmailChange: (email: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `notification-group-${group.key}`;
  return (
    <li className="border-b border-border last:border-b-0">
      <div className="grid grid-cols-[minmax(0,1fr)_96px_104px] items-center gap-4 px-5 py-3.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 items-start gap-2.5 rounded-control text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150", open && "rotate-90")}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="type-label font-semibold text-foreground">{group.label}</span>
            <span className="type-meta text-muted-foreground">
              {open ? (group.count === 1 ? "1 notification" : `${group.count} notifications`) : group.summary}
            </span>
          </span>
        </button>
        <span className="flex justify-center">
          <Check aria-label="Always in Fusion" className="size-4 text-muted-foreground" />
        </span>
        <span className="flex justify-center">
          {group.locked ? (
            <Always />
          ) : (
            <Switch
              aria-label={`Email for ${group.label}`}
              checked={group.email}
              disabled={saving}
              onCheckedChange={onEmailChange}
            />
          )}
        </span>
      </div>
      {open ? (
        <ul id={panelId} className="flex flex-col gap-1 px-5 pb-4 pl-[46px]">
          {group.items.map((item) => (
            <li key={item.label} className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-4 py-1.5">
              <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-foreground/90">
                {item.label}
                {item.team ? (
                  <span className="rounded-control bg-inlay px-1.5 py-0.5 type-meta text-muted-foreground">Your team</span>
                ) : null}
              </span>
              <span className="flex justify-center">{item.always && !group.locked ? <Always /> : null}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Settings › Notifications: what each module tells the person, always in Fusion, and by email per group.
 * Deadline reminders are always emailed. Each choice saves the moment it changes.
 */
export function Notifications() {
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const unavailable = preferences.error instanceof ApiError && preferences.error.status === 403;
  const data = preferences.data;

  const changeEmail = (key: NotificationGroupKey, email: boolean) => {
    if (!data) return;
    const emailOff = data.groups
      .filter((group) => !group.locked && (group.key === key ? !email : !group.email))
      .map((group) => group.key);
    setFailed(false);
    update.mutate(
      { expectedVersion: data.version, emailOff },
      {
        onSuccess: () => setSavedAt(Date.now()),
        onError: () => {
          setFailed(true);
          void preferences.refetch();
        },
      },
    );
  };

  if (preferences.isError && !unavailable) {
    return (
      <SettingsPage title="Notifications">
        <PageError title="Notifications didn't load" onRetry={() => void preferences.refetch()} />
      </SettingsPage>
    );
  }

  const PerformanceIcon = FUSION_MODULE_ICONS.performance;
  return (
    <SettingsPage title="Notifications" loading={preferences.isPending && !unavailable} aside={<SettingsSaved at={savedAt} />}>
      {data?.emailAddress ? (
        <p className="-mt-6 type-meta text-muted-foreground">
          Email goes to <span className="font-semibold text-foreground">{data.emailAddress}</span>
        </p>
      ) : null}
      {unavailable || !data ? (
        <p className="type-body-secondary text-muted-foreground">None of your modules send notifications yet.</p>
      ) : (
        <SettingsBlock
          title={
            <span className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-detail bg-primary-tint text-primary-ink">
                {PerformanceIcon ? <PerformanceIcon aria-hidden className="size-4" /> : null}
              </span>
              Performance
            </span>
          }
        >
          {failed ? (
            <p role="alert" className="type-meta text-destructive">
              That change didn&apos;t save. Your choices are as shown.
            </p>
          ) : null}
          <div className="overflow-hidden rounded-surface border border-border bg-card">
            <div className="grid grid-cols-[minmax(0,1fr)_96px_104px] gap-4 border-b border-border bg-inlay px-5 py-2.5 type-meta font-semibold text-muted-foreground">
              <span>About</span>
              <span className="text-center">In Fusion</span>
              <span className="text-center">Email</span>
            </div>
            <ul>
              {data.groups.map((group) => (
                <GroupRow
                  key={group.key}
                  group={group}
                  saving={update.isPending}
                  onEmailChange={(email) => changeEmail(group.key, email)}
                />
              ))}
            </ul>
          </div>
        </SettingsBlock>
      )}
    </SettingsPage>
  );
}
