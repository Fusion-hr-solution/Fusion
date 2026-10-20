"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CycleSettingsDto, ReviewQuestionAudience, ReviewQuestionDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ds/components/ui/native-select";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { AsyncButton, StatusBadge } from "@repo/ds/shell";
import { PersonInitials } from "@repo/performance-ui";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "@/lib/icons";
import { useRatingScale, useUpdateSettings } from "../../api/use-performance";
import { useReviewQuestionCommands, useReviewQuestions } from "../../api/use-review-work";
import { ContentUnavailable } from "../content-unavailable";
import { SectionHeading } from "./review-parts";

const AUDIENCE_LABEL: Record<ReviewQuestionAudience, string> = { Person: "The person", Manager: "The manager", Peer: "Peers" };
const AUDIENCES: ReviewQuestionAudience[] = ["Person", "Manager", "Peer"];

/**
 * Settings › Reviews (board 17): the tenant's question library by audience, the due-date defaults new rounds copy, and the
 * nine-box bands a calibration session copies when it opens.
 * Plain until the settings redesign (B-071).
 */
export function ReviewSettings({ settings }: { settings: CycleSettingsDto }) {
  return (
    <div className="mt-12 space-y-10">
      <QuestionLibrary />
      <DueDateDefaults settings={settings} />
      <NineBoxBands settings={settings} />
    </div>
  );
}

function QuestionLibrary() {
  const query = useReviewQuestions();
  const commands = useReviewQuestionCommands();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<ReviewQuestionAudience>("Person");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (query.error) return <ContentUnavailable error={query.error} onRetry={query.refetch} subject="Question library" />;
  if (!query.data) return <Skeleton className="h-64 rounded-surface" />;
  const active = query.data.filter((q) => q.state === "Active");
  const archived = query.data.filter((q) => q.state === "Archived");
  const fail = (error: unknown, fallback: string) => toast.error(error instanceof Error ? error.message : fallback);

  const move = (question: ReviewQuestionDto, offset: number) => {
    const same = active.filter((q) => q.audience === question.audience);
    const index = same.findIndex((q) => q.id === question.id);
    const ids = same.map((q) => q.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void commands.reorder.mutateAsync({ audience: question.audience, ids }).catch((error) => fail(error, "The order couldn't be saved."));
  };

  return (
    <section aria-labelledby="library-heading">
      <SectionHeading id="library-heading" title="Question library" count={active.length}
        aside={<Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden />Add question</Button>} />
      <div className="overflow-hidden rounded-surface bg-card">
        <table className="w-full text-left">
          <thead className="bg-inlay">
            <tr className="type-eyebrow text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-semibold">Question</th>
              <th scope="col" className="px-3 py-3 font-semibold">Asked of</th>
              <th scope="col" className="px-3 py-3 font-semibold">Used</th>
              <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {adding ? (
              <tr>
                <td className="px-5 py-3" colSpan={2}>
                  <div className="flex flex-wrap gap-2">
                    <Input autoFocus aria-label="New question" className="min-w-72 flex-1" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you learn from a setback?" />
                    <NativeSelect aria-label="Asked of" value={audience} onChange={(e) => setAudience(e.target.value as ReviewQuestionAudience)}>
                      {AUDIENCES.map((a) => <NativeSelectOption key={a} value={a}>{AUDIENCE_LABEL[a]}</NativeSelectOption>)}
                    </NativeSelect>
                  </div>
                </td>
                <td colSpan={2} className="px-5 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setText(""); }}>Cancel</Button>
                  <AsyncButton size="sm" pending={commands.create.isLoading} disabled={text.trim().length < 5}
                    onClick={() => void commands.create.mutateAsync({ text: text.trim(), audience })
                      .then(() => { setAdding(false); setText(""); })
                      .catch((error) => fail(error, "The question couldn't be added."))}>Add</AsyncButton>
                </td>
              </tr>
            ) : null}
            {AUDIENCES.flatMap((a) => active.filter((q) => q.audience === a)).map((question, _index, all) => {
              const same = all.filter((q) => q.audience === question.audience);
              const position = same.indexOf(question);
              return (
                <tr key={question.id}>
                  <td className="px-5 py-3">
                    {editing === question.id ? (
                      <div className="flex gap-2">
                        <Input aria-label="Question text" className="flex-1" maxLength={300} value={draft} onChange={(e) => setDraft(e.target.value)} />
                        <AsyncButton size="sm" pending={commands.update.isLoading} disabled={draft.trim().length < 5}
                          onClick={() => void commands.update.mutateAsync({ id: question.id, text: draft.trim(), version: question.version })
                            .then(() => setEditing(null)).catch((error) => fail(error, "The question couldn't be saved."))}>Save</AsyncButton>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      </div>
                    ) : <span className="type-body text-foreground">{question.text}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-2 type-body text-foreground">
                      <PersonInitials name={AUDIENCE_LABEL[question.audience]} size="xs" />{AUDIENCE_LABEL[question.audience]}
                    </span>
                  </td>
                  <td className="px-3 py-3 type-meta text-muted-foreground">{question.firstUsedAt ? "Used" : "Not used"}</td>
                  <td className="px-5 py-3">
                    <span className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Move up: ${question.text}`} disabled={position === 0} onClick={() => move(question, -1)}><ChevronUp className="size-4" aria-hidden /></Button>
                      <Button size="icon" variant="ghost" aria-label={`Move down: ${question.text}`} disabled={position === same.length - 1} onClick={() => move(question, 1)}><ChevronDown className="size-4" aria-hidden /></Button>
                      <Button size="icon" variant="ghost" aria-label={`Edit: ${question.text}`} onClick={() => { setEditing(question.id); setDraft(question.text); }}><Pencil className="size-4" aria-hidden /></Button>
                      {question.firstUsedAt ? (
                        <Button size="sm" variant="ghost" onClick={() => void commands.archive.mutateAsync({ id: question.id, version: question.version }).catch((error) => fail(error, "The question couldn't be archived."))}>Archive</Button>
                      ) : (
                        <Button size="icon" variant="ghost" aria-label={`Delete: ${question.text}`}
                          onClick={() => void commands.remove.mutateAsync({ id: question.id, version: question.version }).catch((error) => fail(error, "The question couldn't be deleted."))}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {archived.length ? (
        <p className="mt-3 type-meta text-muted-foreground">
          Archived: {archived.map((q) => q.text).join(" · ")} <StatusBadge tone="muted">Kept in rounds that used them</StatusBadge>
        </p>
      ) : null}
    </section>
  );
}

function DueDateDefaults({ settings }: { settings: CycleSettingsDto }) {
  const update = useUpdateSettings();
  const [values, setValues] = useState({
    selfAssessmentDueDays: settings.selfAssessmentDueDays,
    peerInputDueDays: settings.peerInputDueDays,
    managerAssessmentDueDays: settings.managerAssessmentDueDays,
    acknowledgementReminderDays: settings.acknowledgementReminderDays,
  });
  const rows: { key: keyof typeof values; label: string; unit: string; max: number }[] = [
    { key: "selfAssessmentDueDays", label: "Self-assessment", unit: "days after launch", max: 60 },
    { key: "peerInputDueDays", label: "Peer input", unit: "days after launch", max: 60 },
    { key: "managerAssessmentDueDays", label: "Manager assessment", unit: "days after self", max: 60 },
    { key: "acknowledgementReminderDays", label: "Acknowledgement reminder", unit: "days after release", max: 30 },
  ];
  const changed = rows.some((r) => values[r.key] !== settings[r.key]);
  const valid = rows.every((r) => Number.isInteger(values[r.key]) && values[r.key] >= 1 && values[r.key] <= r.max);
  return (
    <section aria-labelledby="due-heading" className="max-w-xl">
      <SectionHeading id="due-heading" title="Default due dates" aside="New rounds copy these at creation" />
      <div className="divide-y divide-border rounded-surface bg-card">
        {rows.map((row) => (
          <label key={row.key} className="flex items-center gap-3 px-5 py-3">
            <span className="flex-1 type-label text-foreground">{row.label}</span>
            <Input type="number" min={1} max={row.max} className="w-20 text-center tabular-nums" value={values[row.key]}
              onChange={(e) => setValues({ ...values, [row.key]: Number(e.target.value) })} aria-label={`${row.label} default, ${row.unit}`} />
            <span className="w-36 type-meta text-muted-foreground">{row.unit}</span>
          </label>
        ))}
      </div>
      {changed ? (
        <div className="mt-3 flex justify-end">
          <AsyncButton pending={update.isLoading} disabled={!valid}
            onClick={() => void update.mutateAsync({ ...settings, ...values, expectedVersion: settings.version })
              .then(() => toast.success("Default due dates saved."))
              .catch((error) => toast.error(error instanceof Error ? error.message : "The defaults couldn't be saved."))}>
            Save due dates
          </AsyncButton>
        </div>
      ) : null}
    </section>
  );
}

/** Where the nine-box splits the rating scale (D-24): two cut points, each band at least one level. */
function NineBoxBands({ settings }: { settings: CycleSettingsDto }) {
  const update = useUpdateSettings();
  const scale = useRatingScale();
  const [bands, setBands] = useState({ lowTop: settings.nineBoxBands.lowTop, midTop: settings.nineBoxBands.midTop });
  const levels = scale.data?.levels ?? [];
  if (levels.length < 3) return null;
  const top = levels[levels.length - 1]!.value;
  const changed = bands.lowTop !== settings.nineBoxBands.lowTop || bands.midTop !== settings.nineBoxBands.midTop;
  const valid = bands.lowTop >= levels[0]!.value && bands.lowTop < bands.midTop && bands.midTop < top;
  const range = (from: number, to: number) => from === to ? String(from) : `${from}–${to}`;
  const save = (nineBoxBands: { lowTop: number | null; midTop: number | null }, message: string) =>
    void update.mutateAsync({ ...settings, nineBoxBands, expectedVersion: settings.version })
      .then(() => toast.success(message))
      .catch((error) => toast.error(error instanceof Error ? error.message : "The bands couldn't be saved."));
  return (
    <section aria-labelledby="bands-heading" className="max-w-xl">
      <SectionHeading id="bands-heading" title="Nine-box bands" aside={settings.nineBoxBands.custom ? "Custom" : "Default"} />
      <div className="divide-y divide-border rounded-surface bg-card">
        {([["lowTop", "Low band ends at"], ["midTop", "Middle band ends at"]] as const).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 px-5 py-3">
            <span className="flex-1 type-label text-foreground">{label}</span>
            <NativeSelect value={String(bands[key])} aria-label={label} className="w-56"
              onChange={(event) => setBands({ ...bands, [key]: Number(event.target.value) })}>
              {levels.slice(0, -1).map((level) => <NativeSelectOption key={level.value} value={String(level.value)}>{level.value} · {level.label}</NativeSelectOption>)}
            </NativeSelect>
          </label>
        ))}
        <p className="px-5 py-3 type-body tabular-nums text-foreground" aria-live="polite">
          {valid ? `${range(levels[0]!.value, bands.lowTop)} · ${range(bands.lowTop + 1, bands.midTop)} · ${range(bands.midTop + 1, top)}` : "Each band needs at least one level"}
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {settings.nineBoxBands.custom && !changed ? (
          <Button variant="outline" disabled={update.isLoading} onClick={() => save({ lowTop: null, midTop: null }, "Default bands restored.")}>Use the default</Button>
        ) : null}
        {changed ? (
          <AsyncButton pending={update.isLoading} disabled={!valid} onClick={() => save(bands, "Nine-box bands saved.")}>Save bands</AsyncButton>
        ) : null}
      </div>
    </section>
  );
}
