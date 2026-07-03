"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPlatformApiClient } from "@repo/api";
import { useApiQuery, useApiMutation } from "@repo/api/query";
import { performancePaths, performanceQueryKeys } from "@repo/api";
import { canManageObjectiveLibrary, useAuth } from "@repo/auth";
import type {
  ApplicabilityOptionsDto,
  CategoryDto,
  TemplateSummaryDto,
  TemplateRevisionHistoryEntryDto,
  CreateTemplateDraftRequest,
  ActivateTemplateRevisionRequest,
} from "@repo/api";
import { StatusBadge } from "@repo/ds/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { TagChipInput } from "@/components/controls/tag-chip-input";
import { ConfirmDialog } from "@/components/controls/confirm-dialog";
import {
  applicabilityValidationLabel,
  applicabilityValidationTone,
} from "@/lib/labels";
import { toast } from "sonner";

type Tab = "basics" | "measurement" | "classification" | "applicability" | "review";

const NO_CATEGORY = "__none__";

interface TemplateEditorProps {
  mode: "create" | "edit";
  templateId?: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function TemplateEditor({ mode, templateId, onSaved, onCancel }: TemplateEditorProps) {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [tab, setTab] = useState<Tab>("basics");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [measurementSwitchPending, setMeasurementSwitchPending] = useState<"Quantitative" | "Qualitative" | null>(null);
  const { user } = useAuth();
  const readOnly = !canManageObjectiveLibrary(user);

  const { data: template, refetch } = useApiQuery<TemplateSummaryDto>(
    performanceQueryKeys.templateLibraryItem(templateId ?? ""),
    (signal) =>
      apiClient.get<TemplateSummaryDto>(performancePaths.templateLibraryItem(templateId!), { signal }),
    { enabled: mode === "edit" && !!templateId },
  );
  const { data: categories } = useApiQuery<CategoryDto[]>(
    [...performanceQueryKeys.templateCategories(), "with-archived"],
    (signal) =>
      apiClient.get<CategoryDto[]>(`${performancePaths.templateCategories()}?includeArchived=true`, { signal }),
  );
  const { data: revisionHistory } = useApiQuery<TemplateRevisionHistoryEntryDto[]>(
    performanceQueryKeys.templateLibraryHistory(templateId ?? ""),
    (signal) =>
      apiClient.get<TemplateRevisionHistoryEntryDto[]>(
        performancePaths.templateLibraryHistory(templateId!),
        { signal },
      ),
    { enabled: mode === "edit" && !!templateId },
  );
  const { data: applicabilityOptions } = useApiQuery<ApplicabilityOptionsDto>(
    performanceQueryKeys.applicabilityOptions(),
    (signal) =>
      apiClient.get<ApplicabilityOptionsDto>(performancePaths.templateLibraryApplicabilityOptions(), { signal }),
  );

  const draft = template?.draftRevision;
  const active = template?.activeRevision;
  const working = draft ?? active;

  const [title, setTitle] = useState(working?.title ?? "");
  const [description, setDescription] = useState(working?.description ?? "");
  const [categoryId, setCategoryId] = useState(working?.categoryId ?? NO_CATEGORY);
  const [measurementType, setMeasurementType] = useState<"Quantitative" | "Qualitative">(
    working?.measurementType ?? "Qualitative",
  );
  const [suggestedWeighting, setSuggestedWeighting] = useState(working?.suggestedWeighting?.toString() ?? "");
  const [indicator, setIndicator] = useState(working?.indicator ?? "");
  const [targetValue, setTargetValue] = useState(working?.targetValue?.toString() ?? "");
  const [unit, setUnit] = useState(working?.unit ?? "");
  const [expectedOutcome, setExpectedOutcome] = useState(working?.expectedOutcome ?? "");
  const [successCriteria, setSuccessCriteria] = useState(working?.successCriteria ?? "");
  const [tags, setTags] = useState(working?.tags ?? "");
  const [applicableOrgUnitIds, setApplicableOrgUnitIds] = useState<string[]>(working?.applicableOrgUnitIds ?? []);
  const [applicableJobTitles, setApplicableJobTitles] = useState<string[]>(working?.applicableJobTitles ?? []);
  const [applicableWorkLocations, setApplicableWorkLocations] = useState<string[]>(working?.applicableWorkLocations ?? []);
  const [applicableEmploymentTypes, setApplicableEmploymentTypes] = useState<string[]>(working?.applicableEmploymentTypes ?? []);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (working) {
      setTitle(working.title ?? "");
      setDescription(working.description ?? "");
      setCategoryId(working.categoryId ?? NO_CATEGORY);
      setMeasurementType(working.measurementType ?? "Qualitative");
      setSuggestedWeighting(working.suggestedWeighting?.toString() ?? "");
      setIndicator(working.indicator ?? "");
      setTargetValue(working.targetValue?.toString() ?? "");
      setUnit(working.unit ?? "");
      setExpectedOutcome(working.expectedOutcome ?? "");
      setSuccessCriteria(working.successCriteria ?? "");
      setTags(working.tags ?? "");
      setApplicableOrgUnitIds(working.applicableOrgUnitIds ?? []);
      setApplicableJobTitles(working.applicableJobTitles ?? []);
      setApplicableWorkLocations(working.applicableWorkLocations ?? []);
      setApplicableEmploymentTypes(working.applicableEmploymentTypes ?? []);
      setHasUnsaved(false);
    }
  }, [working]);

  const markDirty = () => setHasUnsaved(true);

  const buildRequest = (): CreateTemplateDraftRequest => ({
    title,
    description: description || null,
    categoryId: categoryId === NO_CATEGORY ? null : categoryId,
    measurementType,
    suggestedWeighting: suggestedWeighting ? parseFloat(suggestedWeighting) : null,
    tags: tags || null,
    indicator: indicator || null,
    targetValue: targetValue ? parseFloat(targetValue) : null,
    unit: unit || null,
    expectedOutcome: expectedOutcome || null,
    successCriteria: successCriteria || null,
    applicableOrgUnitIds: applicableOrgUnitIds.length > 0 ? applicableOrgUnitIds : null,
    applicableJobTitles: applicableJobTitles.length > 0 ? applicableJobTitles : null,
    applicableWorkLocations: applicableWorkLocations.length > 0 ? applicableWorkLocations : null,
    applicableEmploymentTypes: applicableEmploymentTypes.length > 0 ? applicableEmploymentTypes : null,
  });

  const categoryLookup = useMemo(
    () => new Map((categories ?? []).map((cat) => [cat.id, cat])),
    [categories],
  );

  const createDraft = useApiMutation<TemplateSummaryDto, CreateTemplateDraftRequest>(
    (req) => apiClient.post<TemplateSummaryDto>(performancePaths.templateLibrary(), req),
    {
      onSuccess: () => { toast.success("Draft created"); setActionError(null); setHasUnsaved(false); onSaved(); },
      onError: (err) => { setActionError(err.message); toast.error(err.message); },
    },
  );

  const saveDraft = useApiMutation<TemplateSummaryDto, CreateTemplateDraftRequest>(
    (req) =>
      apiClient.put<TemplateSummaryDto>(
        performancePaths.templateLibraryDraft(templateId!),
        { ...req, expectedVersion: draft?.version ?? 0 },
        { headers: { "If-Match": `"${draft?.version ?? 0}"` } },
      ),
    {
      onSuccess: () => { toast.success("Draft saved"); setActionError(null); setHasUnsaved(false); void refetch(); },
      onError: (err) => { setActionError(err.message); toast.error(err.message); },
    },
  );

  const activateRevision = useApiMutation<TemplateSummaryDto, ActivateTemplateRevisionRequest>(
    (req) =>
      apiClient.post<TemplateSummaryDto>(
        performancePaths.templateLibraryDraftActivate(templateId!),
        req,
        { headers: { "If-Match": `"${draft?.version ?? 0}"` } },
      ),
    {
      onSuccess: () => { toast.success("Template activated"); setActionError(null); setHasUnsaved(false); onSaved(); },
      onError: (err) => { setActionError(err.message); toast.error(err.message); },
    },
  );

  const handleSaveDraft = () => {
    setActionError(null);
    if (mode === "create") {
      createDraft.mutate(buildRequest());
    } else if (draft) {
      saveDraft.mutate(buildRequest());
    } else {
      apiClient
        .post<TemplateSummaryDto>(performancePaths.templateLibraryRevise(templateId!), buildRequest())
        .then(() => { toast.success("Draft created"); setActionError(null); setHasUnsaved(false); void refetch(); })
        .catch((err: Error) => { setActionError(err.message); toast.error(err.message); });
    }
  };

  const handleActivate = () => {
    if (!templateId || !draft) { toast.error("Save a draft first."); return; }
    if (hasUnsaved) { toast.error("Save the draft before activating."); return; }
    activateRevision.mutate({ changeSummary: null, expectedVersion: draft.version });
  };

  const switchMeasurementType = (to: "Quantitative" | "Qualitative") => {
    if (to === measurementType) return;
    const hasData = indicator || targetValue || unit || expectedOutcome || successCriteria;
    if (hasData) {
      setMeasurementSwitchPending(to);
    } else {
      applyMeasurementSwitch(to);
    }
  };

  const applyMeasurementSwitch = (to: "Quantitative" | "Qualitative") => {
    setMeasurementType(to);
    if (to === "Quantitative") { setExpectedOutcome(""); setSuccessCriteria(""); }
    else { setIndicator(""); setTargetValue(""); setUnit(""); }
    markDirty();
    setMeasurementSwitchPending(null);
  };

  const isBusy = createDraft.isLoading || saveDraft.isLoading || activateRevision.isLoading;

  const tabs: { key: Tab; label: string }[] = [
    { key: "basics", label: "Basics" },
    { key: "measurement", label: "Measurement" },
    { key: "classification", label: "Classification" },
    { key: "applicability", label: "Audience" },
    { key: "review", label: "Review" },
  ];

  return (
    <>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard unsaved changes?"
        description="Your changes to this template will be lost."
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => { setDiscardOpen(false); onCancel(); }}
      />
      <ConfirmDialog
        open={!!measurementSwitchPending}
        onOpenChange={(open) => { if (!open) setMeasurementSwitchPending(null); }}
        title="Switch measurement type?"
        description={
          measurementSwitchPending === "Quantitative"
            ? "Switching to a numeric target clears the expected outcome and success criteria you've entered."
            : "Switching to a qualitative outcome clears the indicator, target, and unit you've entered."
        }
        confirmLabel="Switch and clear"
        onConfirm={() => { if (measurementSwitchPending) applyMeasurementSwitch(measurementSwitchPending); }}
      />

      <div className="space-y-4 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => hasUnsaved ? setDiscardOpen(true) : onCancel()}
            >
              ← Back
            </button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm font-semibold">
              {mode === "create" ? "New template" : (working?.title || "Edit template")}
            </span>
            {template?.code && (
              <span className="text-xs text-muted-foreground font-mono">{template.code}</span>
            )}
            {draft && <StatusBadge tone="warning" dot>Draft v{draft.versionNumber}</StatusBadge>}
            {active && !draft && <StatusBadge tone="success" dot>Active v{active.versionNumber}</StatusBadge>}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isBusy || !title}
              >
                {createDraft.isLoading || saveDraft.isLoading ? "Saving…" : "Save draft"}
              </Button>
              {mode === "edit" && draft && (
                <Button size="sm" onClick={handleActivate} disabled={isBusy || hasUnsaved}>
                  {activateRevision.isLoading ? "Activating…" : "Activate"}
                </Button>
              )}
            </div>
          )}
        </div>

        {actionError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive space-y-1">
            <p className="font-medium">Could not complete that action.</p>
            <p>{actionError}</p>
          </div>
        )}

        {/* Tab strip */}
        <div className="flex gap-0 border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels — a single disabled fieldset makes view-only truly read-only */}
        <fieldset disabled={readOnly} className="min-w-0">
          {tab === "basics" && (
            <BasicsTab
              title={title} setTitle={(v) => { setTitle(v); markDirty(); }}
              description={description} setDescription={(v) => { setDescription(v); markDirty(); }}
              suggestedWeighting={suggestedWeighting} setSuggestedWeighting={(v) => { setSuggestedWeighting(v); markDirty(); }}
            />
          )}
          {tab === "measurement" && (
            <MeasurementTab
              measurementType={measurementType}
              onSwitchType={switchMeasurementType}
              indicator={indicator} setIndicator={(v) => { setIndicator(v); markDirty(); }}
              targetValue={targetValue} setTargetValue={(v) => { setTargetValue(v); markDirty(); }}
              unit={unit} setUnit={(v) => { setUnit(v); markDirty(); }}
              expectedOutcome={expectedOutcome} setExpectedOutcome={(v) => { setExpectedOutcome(v); markDirty(); }}
              successCriteria={successCriteria} setSuccessCriteria={(v) => { setSuccessCriteria(v); markDirty(); }}
            />
          )}
          {tab === "classification" && (
            <ClassificationTab
              categories={categories ?? []}
              categoryId={categoryId}
              setCategoryId={(v) => { setCategoryId(v); markDirty(); }}
              tags={tags}
              setTags={(v) => { setTags(v); markDirty(); }}
            />
          )}
          {tab === "applicability" && (
            <ApplicabilityTab
              options={applicabilityOptions ?? null}
              validationState={working?.applicabilityValidationState ?? "NotValidated"}
              selectedOrgUnitIds={applicableOrgUnitIds}
              setSelectedOrgUnitIds={(v) => { setApplicableOrgUnitIds(v); markDirty(); }}
              selectedJobTitles={applicableJobTitles}
              setSelectedJobTitles={(v) => { setApplicableJobTitles(v); markDirty(); }}
              selectedWorkLocations={applicableWorkLocations}
              setSelectedWorkLocations={(v) => { setApplicableWorkLocations(v); markDirty(); }}
              selectedEmploymentTypes={applicableEmploymentTypes}
              setSelectedEmploymentTypes={(v) => { setApplicableEmploymentTypes(v); markDirty(); }}
            />
          )}
          {tab === "review" && (
            <ReviewTab
              title={title}
              description={description}
              categoryName={
                categoryId !== NO_CATEGORY
                  ? `${categoryLookup.get(categoryId)?.name ?? ""}${categoryLookup.get(categoryId)?.status === "Archived" ? " (archived)" : ""}`
                  : ""
              }
              categorySelected={categoryId !== NO_CATEGORY}
              measurementType={measurementType}
              suggestedWeighting={suggestedWeighting}
              indicator={indicator}
              targetValue={targetValue}
              unit={unit}
              expectedOutcome={expectedOutcome}
              successCriteria={successCriteria}
              tags={tags}
              history={mode === "edit" ? (revisionHistory ?? []) : []}
            />
          )}
        </fieldset>
      </div>
    </>
  );
}

// ── Basics ───────────────────────────────────────────────────────────────────

function BasicsTab({
  title, setTitle,
  description, setDescription,
  suggestedWeighting, setSuggestedWeighting,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  suggestedWeighting: string; setSuggestedWeighting: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Increase customer retention rate"
          maxLength={200}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="desc">Description</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide context for this objective…"
          rows={3}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="weight">Suggested weight (%)</Label>
        <Input
          id="weight"
          type="number"
          min={0}
          max={100}
          value={suggestedWeighting}
          onChange={(e) => setSuggestedWeighting(e.target.value)}
          placeholder="e.g. 20"
          className="w-28"
        />
        <p className="text-xs text-muted-foreground">
          Recommended starting weight within an objective plan.
        </p>
      </div>
    </div>
  );
}

// ── Measurement ──────────────────────────────────────────────────────────────

function MeasurementTab({
  measurementType, onSwitchType,
  indicator, setIndicator,
  targetValue, setTargetValue,
  unit, setUnit,
  expectedOutcome, setExpectedOutcome,
  successCriteria, setSuccessCriteria,
}: {
  measurementType: "Quantitative" | "Qualitative";
  onSwitchType: (v: "Quantitative" | "Qualitative") => void;
  indicator: string; setIndicator: (v: string) => void;
  targetValue: string; setTargetValue: (v: string) => void;
  unit: string; setUnit: (v: string) => void;
  expectedOutcome: string; setExpectedOutcome: (v: string) => void;
  successCriteria: string; setSuccessCriteria: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>How is this objective measured? <span className="text-destructive">*</span></Label>
        <div className="flex gap-2">
          {(["Quantitative", "Qualitative"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onSwitchType(t)}
              aria-pressed={measurementType === t}
              className={`flex-1 rounded-md border px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                measurementType === t
                  ? "border-primary bg-primary/8 text-foreground"
                  : "border-border hover:bg-muted text-foreground"
              }`}
            >
              <span className="block text-sm font-medium">
                {t === "Quantitative" ? "Numeric target" : "Qualitative outcome"}
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                {t === "Quantitative" ? "e.g. 95% retention, 120 calls/day" : "e.g. delivered training programme"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {measurementType === "Quantitative" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="indicator">What is measured? <span className="text-destructive">*</span></Label>
            <Input
              id="indicator"
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              placeholder="e.g. Customer retention rate, calls handled per day"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target">What result should be reached? <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-2">
              <Input
                id="target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="95"
                className="w-32"
              />
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%, calls/day, NPS points…"
                className="w-48"
                aria-label="Unit"
              />
            </div>
            <p className="text-xs text-muted-foreground">Enter the target value and its unit of measurement.</p>
          </div>
        </div>
      )}

      {measurementType === "Qualitative" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="outcome">What outcome is expected? <span className="text-destructive">*</span></Label>
            <Textarea
              id="outcome"
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="Describe the result this objective should produce…"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="criteria">How will success be recognised? <span className="text-destructive">*</span></Label>
            <Textarea
              id="criteria"
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              placeholder="List the observable conditions that show the outcome was achieved…"
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Classification ───────────────────────────────────────────────────────────

function ClassificationTab({
  categories, categoryId, setCategoryId, tags, setTags,
}: {
  categories: CategoryDto[];
  categoryId: string;
  setCategoryId: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
}) {
  // Archived categories cannot be selected for new activation; keep the current
  // selection visible even when archived so existing templates stay truthful.
  const selectable = categories.filter(
    (cat) => cat.status !== "Archived" || cat.id === categoryId,
  );
  const selectedArchived = categories.find((cat) => cat.id === categoryId)?.status === "Archived";

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id="category" className="max-w-xs">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>Not set</SelectItem>
            {selectable.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}{cat.status === "Archived" ? " (archived)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedArchived && (
          <p className="text-xs text-amber-600">
            This category is archived. Choose an active category before activating.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagChipInput
          value={tags}
          onChange={setTags}
          placeholder="Type a tag and press Enter (e.g. leadership, innovation)"
        />
      </div>
    </div>
  );
}

// ── Applicability ────────────────────────────────────────────────────────────

function ApplicabilityTab({
  options, validationState,
  selectedOrgUnitIds, setSelectedOrgUnitIds,
  selectedJobTitles, setSelectedJobTitles,
  selectedWorkLocations, setSelectedWorkLocations,
  selectedEmploymentTypes, setSelectedEmploymentTypes,
}: {
  options: ApplicabilityOptionsDto | null;
  validationState: "NotValidated" | "Valid" | "HasUnresolved";
  selectedOrgUnitIds: string[]; setSelectedOrgUnitIds: (v: string[]) => void;
  selectedJobTitles: string[]; setSelectedJobTitles: (v: string[]) => void;
  selectedWorkLocations: string[]; setSelectedWorkLocations: (v: string[]) => void;
  selectedEmploymentTypes: string[]; setSelectedEmploymentTypes: (v: string[]) => void;
}) {
  const toggleItem = <T,>(items: T[], setItems: (v: T[]) => void, item: T) => {
    setItems(items.includes(item) ? items.filter((i) => i !== item) : [...items, item]);
  };

  const validationLabel = applicabilityValidationLabel(validationState);
  const validationTone = applicabilityValidationTone(validationState);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium">Who should this template be recommended for?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Leave all sections empty to make the template available to everyone.
        </p>
      </div>

      {validationLabel && (
        <StatusBadge tone={validationTone} dot>{validationLabel}</StatusBadge>
      )}
      {validationState === "HasUnresolved" && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          A selected organisation value is no longer available. Resolve before activating.
        </div>
      )}

      <AudienceSection
        title="Organisation areas"
        emptyText="No organisation units available."
        loading={!options}
      >
        {options?.orgUnits.map((ou) => (
          <CheckItem
            key={ou.id}
            id={`ou-${ou.id}`}
            label={ou.name}
            sublabel={ou.code}
            checked={selectedOrgUnitIds.includes(ou.id)}
            onCheckedChange={() => toggleItem(selectedOrgUnitIds, setSelectedOrgUnitIds, ou.id)}
          />
        ))}
      </AudienceSection>

      <AudienceSection title="Job titles" emptyText="No job titles in use." loading={!options}>
        {options?.jobTitles.map((jt) => (
          <CheckItem
            key={jt} id={`jt-${jt}`} label={jt}
            checked={selectedJobTitles.includes(jt)}
            onCheckedChange={() => toggleItem(selectedJobTitles, setSelectedJobTitles, jt)}
          />
        ))}
      </AudienceSection>

      <AudienceSection title="Locations" emptyText="No locations in use." loading={!options}>
        {options?.workLocations.map((wl) => (
          <CheckItem
            key={wl} id={`wl-${wl}`} label={wl}
            checked={selectedWorkLocations.includes(wl)}
            onCheckedChange={() => toggleItem(selectedWorkLocations, setSelectedWorkLocations, wl)}
          />
        ))}
      </AudienceSection>

      <AudienceSection title="Employment types" emptyText="No employment types in use." loading={!options}>
        {options?.employmentTypes.map((et) => (
          <CheckItem
            key={et} id={`et-${et}`} label={et}
            checked={selectedEmploymentTypes.includes(et)}
            onCheckedChange={() => toggleItem(selectedEmploymentTypes, setSelectedEmploymentTypes, et)}
          />
        ))}
      </AudienceSection>
    </div>
  );
}

function AudienceSection({
  title, emptyText, loading, children,
}: {
  title: string; emptyText: string; loading: boolean; children?: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : count === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-md border p-3">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckItem({
  id, label, sublabel, checked, onCheckedChange,
}: {
  id: string; label: string; sublabel?: string; checked: boolean; onCheckedChange: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
      <span className="text-sm leading-snug">
        {label}
        {sublabel && <span className="block text-xs text-muted-foreground">{sublabel}</span>}
      </span>
    </label>
  );
}

// ── Review ───────────────────────────────────────────────────────────────────

function ReviewTab({
  title, description, categoryName, categorySelected, measurementType,
  suggestedWeighting, indicator, targetValue, unit, expectedOutcome, successCriteria, tags,
  history,
}: {
  title: string; description: string; categoryName: string; categorySelected: boolean;
  measurementType: string; suggestedWeighting: string;
  indicator: string; targetValue: string; unit: string;
  expectedOutcome: string; successCriteria: string; tags: string;
  history: TemplateRevisionHistoryEntryDto[];
}) {
  const missing: string[] = [];
  if (!title) missing.push("Title");
  if (!categorySelected) missing.push("Category");
  if (measurementType === "Quantitative") {
    if (!indicator) missing.push("Indicator");
    if (!targetValue || !unit) missing.push("Target and unit");
  }
  if (measurementType === "Qualitative") {
    if (!expectedOutcome) missing.push("Expected outcome");
    if (!successCriteria) missing.push("Success criteria");
  }

  const rows: [string, string | null][] = [
    ["Title", title || "—"],
    ["Description", description || null],
    ["Category", categoryName || "—"],
    ["Measurement", measurementType === "Quantitative" ? "Numeric target" : "Qualitative outcome"],
    ["Suggested weight", suggestedWeighting ? `${suggestedWeighting}%` : null],
    ...(measurementType === "Quantitative"
      ? [
          ["Indicator", indicator || "—"] as [string, string],
          ["Target", targetValue ? `${targetValue} ${unit}`.trim() : "—"] as [string, string],
        ]
      : [
          ["Expected outcome", expectedOutcome || "—"] as [string, string],
          ["Success criteria", successCriteria || "—"] as [string, string],
        ]),
    ["Tags", tags || null],
  ];

  const priorRevisions = history.filter((entry) => entry.status !== "Draft");

  return (
    <div className="space-y-4">
      {missing.length > 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Required before activation: {missing.join(", ")}
        </div>
      )}
      <dl className="space-y-3">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="flex gap-4">
              <dt className="w-40 shrink-0 text-xs text-muted-foreground pt-0.5">{label}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>

      {priorRevisions.length > 0 && (
        <div className="pt-2 space-y-2">
          <p className="text-sm font-medium">Version history</p>
          <ul className="space-y-1.5">
            {priorRevisions.map((entry) => (
              <li key={entry.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-10 shrink-0 text-xs text-muted-foreground">v{entry.versionNumber}</span>
                <span className="flex-1 min-w-0 truncate">
                  {entry.title}
                  {entry.changeSummary ? ` — ${entry.changeSummary}` : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.status === "Active" ? "Current" : "Superseded"}
                  {entry.activatedAt
                    ? ` · ${new Date(entry.activatedAt).toLocaleDateString()}`
                    : ""}
                  {entry.activatedByName ? ` · ${entry.activatedByName}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
