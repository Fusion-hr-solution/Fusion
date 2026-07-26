"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Copy, Eye, GripVertical, Pencil, Plus, Save, ShieldCheck, X } from "lucide-react";
import { createPlatformApiClient, performancePaths, performanceQueryKeys } from "@repo/api";
import type {
  EvaluationRatingScaleDto, EvaluationRatingScaleWriteRequest,
  EvaluationTemplateDto, EvaluationTemplateSectionInput, EvaluationTemplateWriteRequest,
  EvaluationTargetRater,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canManageEvaluations, useAuth } from "@repo/auth";
import { PageContainer, PageEmpty, PageError, PageHeader, PageLoading, PagePermissionNotice, StatusBadge } from "@repo/ds/shell";
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, Field, FieldDescription, FieldGroup, FieldLabel, Input, NativeSelect, Separator, Textarea } from "@repo/ds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Segment = "scales" | "templates";
type Api = ReturnType<typeof createPlatformApiClient>;

/**
 * Unified tenant evaluation setup: rating scales and templates on one page. Each library is
 * read-first — the active item is presented as a finished artifact (the seeded default reads as
 * done, not as an open form), and editing is a deliberate action. Structural change on an in-use
 * item is a duplicate-to-evolve branch, matching the launch-freeze model.
 */
export function EvaluationSetupPage({ initial = "scales" }: { initial?: Segment }) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canManageEvaluations(user);
  const [segment, setSegment] = useState<Segment>(initial);

  const scales = useApiQuery<EvaluationRatingScaleDto[]>(
    performanceQueryKeys.evaluationScales(),
    (signal) => api.get(performancePaths.evaluationScales(), { signal }),
    { enabled: allowed },
  );
  const templates = useApiQuery<EvaluationTemplateDto[]>(
    performanceQueryKeys.evaluationTemplates(),
    (signal) => api.get(performancePaths.evaluationTemplates(), { signal }),
    { enabled: allowed },
  );

  if (authLoading) {
    return <PageContainer><PageLoading label="Checking evaluation access" /></PageContainer>;
  }
  if (!allowed) {
    return <PageContainer><PagePermissionNotice title="Evaluation setup unavailable" description="Tenant evaluation management permission is required." /></PageContainer>;
  }

  const active = segment === "scales" ? scales : templates;

  return (
    <PageContainer width="wide">
      <PageHeader title="Evaluation setup" />
      <div className="flex flex-col gap-6">
        <SegmentedControl
          value={segment}
          onChange={setSegment}
          options={[
            { value: "scales", label: "Rating scales", count: scales.data?.length },
            { value: "templates", label: "Templates", count: templates.data?.length },
          ]}
        />
        {active.isLoading ? (
          <PageLoading />
        ) : active.error ? (
          <PageError title="Setup could not be loaded" description="No values were changed. Try again." onRetry={active.refetch} />
        ) : segment === "scales" ? (
          <ScaleLibrary items={scales.data ?? []} refetch={scales.refetch} api={api} />
        ) : (
          <TemplateLibrary items={templates.data ?? []} refetch={templates.refetch} api={api} />
        )}
      </div>
    </PageContainer>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Shared shell                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

function SegmentedControl<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div role="tablist" aria-label="Evaluation setup area" className="inline-flex w-fit gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", selected ? "bg-muted text-muted-foreground" : "text-muted-foreground/70")}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Compact horizontal item switcher — only earns its space when there is more than one item, so a
 *  single-scale tenant never sees a half-empty rail. */
function LibrarySwitcher({
  items, selectedId, onSelect, onNew, newLabel,
}: {
  items: Array<{ id: string; name: string; status: string; isInUse: boolean }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  newLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={selected}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate font-medium">{item.name}</span>
            <StatusDot status={item.status} isInUse={item.isInUse} />
          </button>
        );
      })}
      <Button variant="outline" size="sm" onClick={onNew}><Plus data-icon="inline-start" />{newLabel}</Button>
    </div>
  );
}

function StatusDot({ status, isInUse }: { status: string; isInUse: boolean }) {
  const tone = isInUse ? "bg-primary" : status === "Active" ? "bg-emerald-500" : status === "Archived" ? "bg-muted-foreground/50" : "bg-amber-500";
  return <span className={cn("size-1.5 rounded-full", tone)} aria-hidden />;
}

function LifecycleBadge({ status, isInUse }: { status: string; isInUse: boolean }) {
  if (isInUse) return <StatusBadge tone="info">In use</StatusBadge>;
  const tone = status === "Active" ? "success" : status === "Archived" ? "muted" : "warning";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

function ArtifactHeader({
  name, status, isInUse, isNew, actions,
}: {
  name: string;
  status?: string;
  isInUse?: boolean;
  isNew?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
        {isNew ? <Badge variant="outline">Draft</Badge> : status ? <LifecycleBadge status={status} isInUse={!!isInUse} /> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Rating scales                                                                                    */
/* ---------------------------------------------------------------------------------------------- */

function ScaleLibrary({ items, refetch, api }: { items: EvaluationRatingScaleDto[]; refetch: () => Promise<unknown>; api: Api }) {
  const [selectedId, setSelectedId] = useState<string | null>(preferredActive(items));
  const selected = items.find((x) => x.id === selectedId) ?? null;
  const [editing, setEditing] = useState(items.length === 0);
  const [form, setForm] = useState<EvaluationRatingScaleWriteRequest>(() => emptyScale());

  useEffect(() => {
    setForm(selected ? { name: selected.name, description: selected.description, levels: selected.levels } : emptyScale());
    setEditing(!selected);
  }, [selected]);

  const save = useApiMutation<EvaluationRatingScaleDto, EvaluationRatingScaleWriteRequest>(
    (body) => (selected ? api.put(performancePaths.evaluationScale(selected.id), body) : api.post(performancePaths.evaluationScales(), body)),
    { onSuccess: async (value) => { toast.success(selected ? "Rating scale saved" : "Rating scale created"); setSelectedId(value.id); setEditing(false); await refetch(); } },
  );
  const transition = async (status: "Active" | "Archived") => { if (!selected) return; await api.post(performancePaths.evaluationScaleStatus(selected.id), { status }); toast.success(status === "Active" ? "Rating scale activated" : "Rating scale archived"); await refetch(); };
  const duplicate = async () => { if (!selected) return; const copy = await api.post<EvaluationRatingScaleDto>(performancePaths.evaluationScaleDuplicate(selected.id), { name: `${selected.name} copy` }); setSelectedId(copy.id); toast.success("Independent draft created"); await refetch(); };
  const validation = form.name.trim() && form.levels.length >= 3 && form.levels.length <= 7 ? null : "Add a name and between 3 and 7 ordered levels.";
  const frozen = !!selected?.isInUse;

  if (items.length === 0 && !editing) {
    return <PageEmpty title="No rating scale yet" description="Start from the professional default, then adjust the language if your tenant needs it." action={<Button onClick={() => { setSelectedId(null); setEditing(true); }}><Plus data-icon="inline-start" />Create scale</Button>} />;
  }

  const beginNew = () => { setSelectedId(null); setEditing(true); };

  return (
    <div className="flex flex-col gap-6">
      {items.length > 1 ? (
        <LibrarySwitcher items={items} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} onNew={beginNew} newLabel="New scale" />
      ) : null}

      <ArtifactHeader
        name={selected ? selected.name : "New rating scale"}
        status={selected?.status}
        isInUse={selected?.isInUse}
        isNew={!selected}
        actions={selected ? (
          <>
            {items.length <= 1 ? <Button variant="ghost" size="sm" onClick={beginNew}><Plus data-icon="inline-start" />New</Button> : null}
            <Button variant="outline" size="sm" onClick={duplicate}><Copy data-icon="inline-start" />Duplicate</Button>
            {!frozen && !editing ? <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil data-icon="inline-start" />Edit</Button> : null}
            {selected.status === "Draft" ? <Button variant="outline" size="sm" onClick={() => transition("Active")}><ShieldCheck data-icon="inline-start" />Activate</Button> : selected.status === "Active" ? <Button variant="outline" size="sm" onClick={() => transition("Archived")}><Archive data-icon="inline-start" />Archive</Button> : null}
          </>
        ) : null}
      />

      {frozen ? (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Structure frozen</AlertTitle>
          <AlertDescription>This scale is part of a launched evaluation. Duplicate it to evolve the structure.</AlertDescription>
        </Alert>
      ) : null}

      {editing && !frozen ? (
        <ScaleEditor
          form={form}
          setForm={setForm}
          validation={validation}
          saving={save.isLoading}
          canCancel={!!selected}
          onCancel={() => { setForm(selected ? { name: selected.name, description: selected.description, levels: selected.levels } : emptyScale()); setEditing(false); }}
          onSave={() => save.mutate(form)}
        />
      ) : selected ? (
        <ScaleArtifact scale={selected} />
      ) : null}
    </div>
  );
}

/** The signature shape: an ordered intensity spine, lowest → highest, with the derived number
 *  leading each level. Reads the whole scale in one glance without a form. */
function ScaleArtifact({ scale }: { scale: EvaluationRatingScaleDto }) {
  const n = scale.levels.length;
  return (
    <div className="flex flex-col gap-5">
      {scale.description ? <p className="max-w-prose text-sm text-muted-foreground">{scale.description}</p> : null}
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        {scale.levels.map((level, i) => (
          <div key={level.id ?? i} className="min-w-[8rem] flex-1 basis-36">
            <div className="h-1.5 rounded-full bg-primary" style={{ opacity: n > 1 ? 0.35 + (0.65 * i) / (n - 1) : 1 }} aria-hidden />
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums leading-none">{level.value ?? i + 1}</span>
              <span className="font-medium leading-tight">{level.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScaleEditor({
  form, setForm, validation, saving, canCancel, onCancel, onSave,
}: {
  form: EvaluationRatingScaleWriteRequest;
  setForm: (value: EvaluationRatingScaleWriteRequest) => void;
  validation: string | null;
  saving: boolean;
  canCancel: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Card><CardContent className="pt-6"><FieldGroup>
      <Field><FieldLabel htmlFor="scale-name">Name</FieldLabel><Input id="scale-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field><FieldLabel htmlFor="scale-description">Purpose</FieldLabel><Textarea id="scale-description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field>
        <div className="flex items-center justify-between">
          <div><FieldLabel>Ordered levels</FieldLabel><FieldDescription>Lowest to highest. The number is derived from position.</FieldDescription></div>
          <Button variant="outline" size="sm" disabled={form.levels.length >= 7} onClick={() => setForm({ ...form, levels: [...form.levels, { label: "New level", description: "", behavioralGuidance: "" }] })}><Plus data-icon="inline-start" />Add level</Button>
        </div>
        <div className="flex flex-col gap-2">
          {form.levels.map((level, index) => (
            <div key={level.id ?? index} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[2.5rem_1fr_1fr_1fr_auto]">
              <span className="flex items-center gap-1 text-sm font-semibold tabular-nums"><GripVertical className="text-muted-foreground" />{index + 1}</span>
              <Input aria-label={`Level ${index + 1} label`} value={level.label} onChange={(e) => updateLevel(setForm, form, index, "label", e.target.value)} />
              <Input aria-label={`Level ${index + 1} description`} placeholder="Concise description" value={level.description ?? ""} onChange={(e) => updateLevel(setForm, form, index, "description", e.target.value)} />
              <Input aria-label={`Level ${index + 1} guidance`} placeholder="Behavioral guidance" value={level.behavioralGuidance ?? ""} onChange={(e) => updateLevel(setForm, form, index, "behavioralGuidance", e.target.value)} />
              <Button variant="ghost" size="sm" disabled={form.levels.length <= 3} onClick={() => setForm({ ...form, levels: form.levels.filter((_, i) => i !== index) })}>Remove</Button>
            </div>
          ))}
        </div>
      </Field>
      {validation ? <p className="text-sm text-destructive" role="alert">{validation}</p> : null}
      <div className="flex justify-end gap-2">
        {canCancel ? <Button variant="ghost" onClick={onCancel}><X data-icon="inline-start" />Cancel</Button> : null}
        <Button disabled={!!validation || saving} onClick={onSave}><Save data-icon="inline-start" />{saving ? "Saving…" : "Save scale"}</Button>
      </div>
    </FieldGroup></CardContent></Card>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Templates                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

function TemplateLibrary({ items, refetch, api }: { items: EvaluationTemplateDto[]; refetch: () => Promise<unknown>; api: Api }) {
  const [selectedId, setSelectedId] = useState<string | null>(preferredActive(items));
  const selected = items.find((x) => x.id === selectedId) ?? null;
  const [mode, setMode] = useState<"view" | "edit" | "preview">("view");
  const [preview, setPreview] = useState<EvaluationTargetRater>("Self");
  const [form, setForm] = useState<EvaluationTemplateWriteRequest>(() => emptyTemplate());

  useEffect(() => {
    setForm(selected ? { name: selected.name, purpose: selected.purpose, participantInstructions: selected.participantInstructions, sections: selected.sections } : emptyTemplate());
    setMode(selected ? "view" : "edit");
  }, [selected]);

  const save = useApiMutation<EvaluationTemplateDto, EvaluationTemplateWriteRequest>(
    (body) => (selected ? api.put(performancePaths.evaluationTemplate(selected.id), body) : api.post(performancePaths.evaluationTemplates(), body)),
    { onSuccess: async (value) => { setSelectedId(value.id); setMode("view"); toast.success("Evaluation template saved"); await refetch(); } },
  );
  const transition = async (status: "Active" | "Archived") => { if (!selected) return; await api.post(performancePaths.evaluationTemplateStatus(selected.id), { status }); toast.success(`Template ${status.toLowerCase()}`); await refetch(); };
  const duplicate = async () => { if (!selected) return; const copy = await api.post<EvaluationTemplateDto>(performancePaths.evaluationTemplateDuplicate(selected.id), { name: `${selected.name} copy` }); setSelectedId(copy.id); toast.success("Independent draft created"); await refetch(); };
  const frozen = !!selected?.isInUse;

  if (items.length === 0 && mode !== "edit") {
    return <PageEmpty title="No template yet" description="Start from the starter annual template, then shape the questions your reviews should ask." action={<Button onClick={() => { setSelectedId(null); setMode("edit"); }}><Plus data-icon="inline-start" />Create template</Button>} />;
  }

  const beginNew = () => { setSelectedId(null); setMode("edit"); };

  return (
    <div className="flex flex-col gap-6">
      {items.length > 1 ? (
        <LibrarySwitcher items={items} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} onNew={beginNew} newLabel="New template" />
      ) : null}

      <ArtifactHeader
        name={selected ? selected.name : "New evaluation template"}
        status={selected?.status}
        isInUse={selected?.isInUse}
        isNew={!selected}
        actions={selected ? (
          <>
            {items.length <= 1 ? <Button variant="ghost" size="sm" onClick={beginNew}><Plus data-icon="inline-start" />New</Button> : null}
            <Button variant={mode === "preview" ? "secondary" : "outline"} size="sm" onClick={() => setMode(mode === "preview" ? "view" : "preview")}><Eye data-icon="inline-start" />Preview</Button>
            <Button variant="outline" size="sm" onClick={duplicate}><Copy data-icon="inline-start" />Duplicate</Button>
            {!frozen && mode !== "edit" ? <Button variant="outline" size="sm" onClick={() => setMode("edit")}><Pencil data-icon="inline-start" />Edit</Button> : null}
            {selected.status === "Draft" ? <Button variant="outline" size="sm" onClick={() => transition("Active")}><ShieldCheck data-icon="inline-start" />Activate</Button> : selected.status === "Active" ? <Button variant="outline" size="sm" onClick={() => transition("Archived")}><Archive data-icon="inline-start" />Archive</Button> : null}
          </>
        ) : null}
      />

      {frozen ? (
        <Alert>
          <ShieldCheck />
          <AlertTitle>Structure frozen</AlertTitle>
          <AlertDescription>Launched rounds keep this structure. Duplicate the template to make a new draft.</AlertDescription>
        </Alert>
      ) : null}

      {mode === "preview" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Preview as</span>
            <NativeSelect value={preview} onChange={(e) => setPreview(e.target.value as EvaluationTargetRater)}>
              <option value="Self">Employee</option>
              <option value="Manager">Manager</option>
            </NativeSelect>
          </div>
          <TemplatePreview form={form} rater={preview} />
        </div>
      ) : mode === "edit" && !frozen ? (
        <TemplateEditor
          form={form}
          setForm={setForm}
          saving={save.isLoading}
          canCancel={!!selected}
          onCancel={() => { setForm(selected ? { name: selected.name, purpose: selected.purpose, participantInstructions: selected.participantInstructions, sections: selected.sections } : emptyTemplate()); setMode("view"); }}
          onSave={() => save.mutate(form)}
        />
      ) : selected ? (
        <TemplateArtifact template={selected} />
      ) : null}
    </div>
  );
}

/** Structural outline at a glance: purpose, then each section and its questions with who answers
 *  and whether it's required. The "meaning" of the template without opening a form. */
function TemplateArtifact({ template }: { template: EvaluationTemplateDto }) {
  return (
    <div className="flex flex-col gap-5">
      {template.purpose ? <p className="max-w-prose text-sm text-muted-foreground">{template.purpose}</p> : null}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {template.sections.map((section) => (
          <div key={section.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{section.title}</h3>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{humanizeSectionType(section.type)}</span>
            </div>
            {section.questions.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2.5">
                {section.questions.map((q) => (
                  <li key={q.id} className="flex items-start gap-3">
                    <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", q.isRequired ? "bg-primary" : "bg-muted-foreground/40")} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm">{q.prompt}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span>{q.type === "Rating" ? "Rating" : "Written"}</span>
                        <span aria-hidden>·</span>
                        <span>{raterLabel(q.targetRater)}</span>
                        <span aria-hidden>·</span>
                        <span>{q.isRequired ? "Required" : "Optional"}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{sectionEmptyHint(section.type)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({
  form, setForm, saving, canCancel, onCancel, onSave,
}: {
  form: EvaluationTemplateWriteRequest;
  setForm: (value: EvaluationTemplateWriteRequest) => void;
  saving: boolean;
  canCancel: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Card><CardContent className="pt-6"><FieldGroup>
      <Field><FieldLabel htmlFor="template-name">Name</FieldLabel><Input id="template-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field><FieldLabel htmlFor="template-purpose">Purpose</FieldLabel><Textarea id="template-purpose" value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
      <Field><FieldLabel htmlFor="template-instructions">Participant instructions</FieldLabel><Textarea id="template-instructions" value={form.participantInstructions ?? ""} onChange={(e) => setForm({ ...form, participantInstructions: e.target.value })} /></Field>
      <Separator />
      {form.sections.map((section, sectionIndex) => (
        <TemplateSectionEditor key={section.id ?? sectionIndex} section={section} onChange={(next) => setForm({ ...form, sections: form.sections.map((item, i) => (i === sectionIndex ? next : item)) })} />
      ))}
      <div className="flex justify-end gap-2">
        {canCancel ? <Button variant="ghost" onClick={onCancel}><X data-icon="inline-start" />Cancel</Button> : null}
        <Button disabled={!form.name.trim() || saving} onClick={onSave}><Save data-icon="inline-start" />{saving ? "Saving…" : "Save template"}</Button>
      </div>
    </FieldGroup></CardContent></Card>
  );
}

function TemplateSectionEditor({ section, onChange }: { section: EvaluationTemplateSectionInput; onChange: (value: EvaluationTemplateSectionInput) => void }) {
  return (
    <Field>
      <div className="flex items-center justify-between">
        <div><FieldLabel>{section.title}</FieldLabel><FieldDescription>{humanizeSectionType(section.type)}</FieldDescription></div>
        {section.type === "CustomQuestions" ? <Button variant="outline" size="sm" onClick={() => onChange({ ...section, questions: [...section.questions, { prompt: "", type: "Rating", isRequired: true, targetRater: "Both", allowNotApplicable: true }] })}><Plus data-icon="inline-start" />Question</Button> : null}
      </div>
      <Input aria-label={`${section.title} title`} value={section.title} onChange={(e) => onChange({ ...section, title: e.target.value })} />
      {section.questions.map((question, index) => (
        <div key={question.id ?? index} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[minmax(0,1fr)_9rem_9rem_11rem_auto]">
          <Input aria-label={`Question ${index + 1}`} value={question.prompt} onChange={(e) => onChange({ ...section, questions: section.questions.map((item, i) => (i === index ? { ...item, prompt: e.target.value } : item)) })} />
          <NativeSelect aria-label="Question type" value={question.type} onChange={(e) => onChange({ ...section, questions: section.questions.map((item, i) => (i === index ? { ...item, type: e.target.value as "Text" | "Rating", allowNotApplicable: e.target.value === "Rating" && item.allowNotApplicable } : item)) })}>
            <option value="Rating">Rating</option>
            <option value="Text">Text</option>
          </NativeSelect>
          <NativeSelect aria-label="Target rater" value={question.targetRater} onChange={(e) => onChange({ ...section, questions: section.questions.map((item, i) => (i === index ? { ...item, targetRater: e.target.value as EvaluationTargetRater } : item)) })}>
            <option value="Both">Both</option>
            <option value="Self">Employee</option>
            <option value="Manager">Manager</option>
          </NativeSelect>
          <div className="flex gap-1">
            <Button variant={question.isRequired ? "secondary" : "outline"} size="sm" aria-pressed={question.isRequired} onClick={() => onChange({ ...section, questions: section.questions.map((item, i) => (i === index ? { ...item, isRequired: !item.isRequired } : item)) })}>Required</Button>
            {question.type === "Rating" ? <Button variant={question.allowNotApplicable ? "secondary" : "outline"} size="sm" aria-pressed={question.allowNotApplicable} onClick={() => onChange({ ...section, questions: section.questions.map((item, i) => (i === index ? { ...item, allowNotApplicable: !item.allowNotApplicable } : item)) })}>N/A</Button> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...section, questions: section.questions.filter((_, i) => i !== index) })}>Remove</Button>
        </div>
      ))}
    </Field>
  );
}

function TemplatePreview({ form, rater }: { form: EvaluationTemplateWriteRequest; rater: EvaluationTargetRater }) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{rater === "Self" ? "Employee view" : "Manager view"}</p>
        <h3 className="mt-1 text-xl font-semibold">{form.name || "Untitled evaluation"}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{form.participantInstructions || "Instructions appear here."}</p>
      </div>
      {form.sections.map((section, index) => {
        const questions = section.questions.filter((q) => q.targetRater === "Both" || q.targetRater === rater);
        return (
          <section key={section.id ?? index}>
            <h4 className="font-semibold">{section.title}</h4>
            {questions.length ? (
              <div className="mt-3 flex flex-col gap-3">
                {questions.map((q, i) => (
                  <div key={q.id ?? i} className="rounded-lg bg-muted/60 p-3">
                    <p className="text-sm font-medium">{q.prompt || "Untitled question"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{q.type === "Rating" ? "Rating scale response" : "Written response"}{q.isRequired ? " · Required" : " · Optional"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">This section uses the participant&apos;s frozen objective baseline.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Helpers                                                                                          */
/* ---------------------------------------------------------------------------------------------- */

function preferredActive<T extends { id: string; status: string }>(items: T[]): string | null {
  return (items.find((x) => x.status === "Active") ?? items[0])?.id ?? null;
}
function raterLabel(rater: EvaluationTargetRater): string {
  return rater === "Self" ? "Employee" : rater === "Manager" ? "Manager" : "Employee & manager";
}
function humanizeSectionType(type: string): string {
  return type.replace(/([A-Z])/g, " $1").trim();
}
function sectionEmptyHint(type: string): string {
  switch (type) {
    case "Objectives": return "Uses the participant's frozen objective baseline.";
    case "OverallComments": return "A free-form overall summary from each reviewer.";
    case "Skills": return "Uses the tenant skills framework.";
    default: return "No questions in this section.";
  }
}
function emptyScale(): EvaluationRatingScaleWriteRequest {
  return { name: "", description: "", levels: ["Needs significant improvement", "Developing", "Meets expectations", "Exceeds expectations", "Exceptional"].map((label) => ({ label, description: "", behavioralGuidance: "" })) };
}
function emptyTemplate(): EvaluationTemplateWriteRequest {
  return {
    name: "", purpose: "", participantInstructions: "Reflect on outcomes, evidence, and development priorities.",
    sections: [
      { type: "Objectives", title: "Objectives", guidance: "Review progress against the frozen objective baseline.", questions: [] },
      { type: "CustomQuestions", title: "Reflection", guidance: "", questions: [
        { prompt: "What outcomes are you most proud of?", type: "Text", isRequired: true, targetRater: "Self", allowNotApplicable: false },
        { prompt: "How consistently were expectations demonstrated?", type: "Rating", isRequired: true, targetRater: "Both", allowNotApplicable: true },
      ] },
      { type: "OverallComments", title: "Overall comments", guidance: "Summarize the evaluation.", questions: [] },
    ],
  };
}
function updateLevel(setForm: (value: EvaluationRatingScaleWriteRequest) => void, form: EvaluationRatingScaleWriteRequest, index: number, key: "label" | "description" | "behavioralGuidance", value: string) {
  setForm({ ...form, levels: form.levels.map((level, i) => (i === index ? { ...level, [key]: value } : level)) });
}
