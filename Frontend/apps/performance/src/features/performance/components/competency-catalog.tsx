"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AsyncButton } from "@repo/ds/shell";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@repo/ds/components/ui/alert-dialog";
import type { CompetencyDto } from "@repo/api";
import { useCompetencies, useCompetencyMutations } from "../api/use-performance";
import { ContentUnavailable } from "./content-unavailable";
import { useTranslations } from "next-intl";
import { reportPerformanceFailure } from "@/features/performance/api/performance-failure";

type Draft = { id?: string; version?: number; name: string; description: string; behaviors: string };
const empty: Draft = { name: "", description: "", behaviors: "" };

export function CompetencyCatalog() {
  const t = useTranslations("common.CompetencyCatalog");
  const query = useCompetencies();
  const mutations = useCompetencyMutations();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<CompetencyDto | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const visible = (query.data ?? []).filter((item) => showArchived || item.state === "Active");
  const busy = mutations.create.isLoading || mutations.update.isLoading;

  async function save() {
    if (!draft) return;
    const request = { name: draft.name.trim(), description: draft.description.trim(), behaviors: draft.behaviors.split("\n").map((value) => value.trim()).filter(Boolean) };
    try {
      if (draft.id) {
        if (draft.version === undefined) throw new Error("Refresh the competency before making changes.");
        await mutations.update.mutateAsync({ id: draft.id, expectedVersion: draft.version, ...request });
      } else await mutations.create.mutateAsync(request);
      toast.success(draft.id ? "Competency updated." : "Competency added.");
      setDraft(null);
    } catch (error) { reportPerformanceFailure(error, t("couldNotSaveCompetency")); }
  }

  return (
    <section className="mt-10" aria-labelledby="competencies-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div><h3 id="competencies-title" className="type-section-title">{t("competencies")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("newRoundsCanUseThese")}</p></div>
        <Button variant="outline" onClick={() => setDraft({ ...empty })}>{t("addCompetency")}</Button>
      </div>
      {draft ? (
        <div className="my-4 grid gap-3 border-b border-border pb-5" aria-label={draft.id ? t("editCompetency") : t("newCompetency")}>
          <Input aria-label={t("competencyName")} placeholder={t("name")} maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <textarea aria-label={t("description")} placeholder={t("whatThisCompetencyMeans")} maxLength={2000} rows={2} className="min-h-20 rounded-control border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <textarea aria-label={t("observableBehaviors")} placeholder={t("observableBehaviorsOnePerLine")} rows={3} className="min-h-24 rounded-control border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={draft.behaviors} onChange={(event) => setDraft({ ...draft, behaviors: event.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDraft(null)}>{t("cancel")}</Button><AsyncButton pending={busy} disabled={!draft.name.trim() || !draft.description.trim()} onClick={save}>{t("saveCompetency")}</AsyncButton></div>
        </div>
      ) : null}
      {query.isLoading ? <p className="py-5 text-sm text-muted-foreground">{t("loadingCompetencies")}</p> : query.error ? <ContentUnavailable error={query.error} onRetry={query.refetch} subject={t("competencies")} /> : (
        <>
          {visible.length ? <ul className="divide-y divide-border border-b border-border">
            {visible.map((item) => <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="type-label">{item.name}</span>{item.state === "Archived" ? <span className="type-meta text-muted-foreground">{t("archived")}</span> : null}{item.firstUsedAt ? <span className="type-meta text-muted-foreground">{t("usedInALaunchedRound")}</span> : null}</div><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{item.description}</p>{item.behaviors.length ? <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">{item.behaviors.map((behavior) => <li key={behavior} className="text-muted-foreground">{behavior}</li>)}</ul> : null}</div>
              <div className="flex shrink-0 flex-wrap gap-2">{item.state === "Active" ? <><Button variant="ghost" size="sm" onClick={() => setDraft({ id: item.id, version: item.version, name: item.name, description: item.description, behaviors: item.behaviors.join("\n") })}>{t("edit")}</Button><Button variant="ghost" size="sm" onClick={async () => { try { await mutations.archive.mutateAsync({ id: item.id, expectedVersion: item.version }); toast.success(t("competencyArchived")); } catch (error) { reportPerformanceFailure(error, t("couldNotArchiveCompetency")); } }}>{t("archive")}</Button></> : null}{!item.firstUsedAt ? <Button variant="ghost" size="sm" onClick={() => setDeleting(item)}>{t("delete")}</Button> : null}</div>
            </li>)}
          </ul> : <p className="border-b border-border py-5 text-sm text-muted-foreground">{t("no")} {showArchived ? t("competencies2") : t("activeCompetencies")} {t("yet")}</p>}
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />{t("showArchived")}</label>
        </>
      )}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteThisCompetency")}</AlertDialogTitle>
            <AlertDialogDescription>{t("willBeRemovedFromThe", { name: deleting?.name ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild><AsyncButton variant="destructive" pending={mutations.remove.isLoading} onClick={async () => {
              if (!deleting) return;
              try { await mutations.remove.mutateAsync({ id: deleting.id, expectedVersion: deleting.version }); toast.success(t("competencyDeleted")); setDeleting(null); }
              catch (error) { reportPerformanceFailure(error, t("couldNotDeleteCompetency")); }
            }}>{t("deleteCompetency")}</AsyncButton></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
