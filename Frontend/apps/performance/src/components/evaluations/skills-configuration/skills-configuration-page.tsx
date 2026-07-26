"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Copy,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  ProficiencyScaleDto,
  ProficiencyScaleWriteRequest,
  SkillCategoryDto,
  SkillDto,
  SkillExpectationSetDto,
  SkillExpectationSetWriteRequest,
  SkillNameRequest,
  SkillWriteRequest,
  SkillsConfigurationWorkspaceDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canManageSkills, useAuth } from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PageHeader,
  PageListSkeleton,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from "@repo/ds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "catalogue" | "scales" | "sets";
type Api = ReturnType<typeof createPlatformApiClient>;

const TAB_LABELS: Record<Tab, string> = {
  catalogue: "Catalogue",
  scales: "Proficiency scales",
  sets: "Expectation sets",
};

export function SkillsConfigurationPage() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canManageSkills(user);
  const workspace = useApiQuery<SkillsConfigurationWorkspaceDto>(
    performanceQueryKeys.skillsWorkspace(),
    (signal) => api.get(performancePaths.skillsWorkspace(), { signal }),
    { enabled: allowed }
  );
  const [tab, setTab] = useState<Tab>("catalogue");

  if (authLoading || (allowed && workspace.isLoading))
    return (
      <PageContainer width="wide">
        <PageListSkeleton />
      </PageContainer>
    );
  if (!allowed)
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Skills unavailable"
          description="Skills management permission is required."
        />
      </PageContainer>
    );
  if (workspace.error || !workspace.data)
    return (
      <PageContainer width="wide">
        <PageError
          title="Skills could not be loaded"
          onRetry={workspace.refetch}
        />
      </PageContainer>
    );

  const data = workspace.data;
  const isEmpty =
    data.categories.length === 0 &&
    data.skills.length === 0 &&
    data.proficiencyScales.length === 0 &&
    data.expectationSets.length === 0;

  if (isEmpty)
    return (
      <PageContainer width="wide">
        <PageHeader title="Skills" />
        <ProvisionEmptyState api={api} onProvisioned={workspace.refetch} />
      </PageContainer>
    );

  const counts: Record<Tab, number> = {
    catalogue: data.skills.length,
    scales: data.proficiencyScales.length,
    sets: data.expectationSets.length,
  };

  return (
    <PageContainer width="wide">
      <PageHeader title="Skills" />
      <div className="flex flex-col gap-6">
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Skills configuration"
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === value
                  ? "border-primary/40 bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {TAB_LABELS[value]}
              <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                {counts[value]}
              </span>
            </button>
          ))}
        </div>
        {tab === "catalogue" ? (
          <CatalogueTab
            api={api}
            categories={data.categories}
            skills={data.skills}
            refetch={workspace.refetch}
          />
        ) : null}
        {tab === "scales" ? (
          <ScaleGroup
            api={api}
            items={data.proficiencyScales}
            refetch={workspace.refetch}
          />
        ) : null}
        {tab === "sets" ? (
          <SetGroup
            api={api}
            items={data.expectationSets}
            scales={data.proficiencyScales}
            skills={data.skills}
            refetch={workspace.refetch}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}

function ProvisionEmptyState({
  api,
  onProvisioned,
}: {
  api: Api;
  onProvisioned: () => Promise<unknown>;
}) {
  const provision = useApiMutation<SkillsConfigurationWorkspaceDto, void>(
    () => api.post(performancePaths.provisionSkillDefaults(), {}),
    {
      onSuccess: async () => {
        toast.success("Fusion skill defaults added");
        await onProvisioned();
      },
      onError: () => {
        toast.error("Could not add the defaults.");
      },
    }
  );
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <Sparkles aria-hidden className="size-8 text-primary" />
      <p className="text-lg font-medium">Set up your skills catalogue</p>
      <Button
        disabled={provision.isLoading}
        onClick={() => provision.mutate()}
      >
        <Sparkles data-icon="inline-start" />
        Start with Fusion defaults
      </Button>
    </div>
  );
}

function GroupHeader({
  title,
  count,
  onNew,
  action = "New",
}: {
  title: string;
  count: number;
  onNew: () => void;
  action?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{count} configured</p>
      </div>
      <Button onClick={onNew}>
        <Plus data-icon="inline-start" />
        {action}
      </Button>
    </div>
  );
}

function Life({ status, inUse }: { status: string; inUse?: boolean }) {
  if (inUse) return <StatusBadge tone="info">In use</StatusBadge>;
  return (
    <StatusBadge tone={status === "Active" ? "success" : "muted"}>
      {status}
    </StatusBadge>
  );
}

function ArchiveAction({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <Archive data-icon="inline-start" />
      Archive
    </Button>
  );
}

/** Read-first intensity spine for a proficiency scale (ScaleArtifact pattern). */
function ScaleSpine({
  levels,
}: {
  levels: Array<{ ordinal: number; label: string; description?: string | null }>;
}) {
  const n = levels.length;
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-4">
      {levels.map((level, i) => (
        <div key={level.ordinal} className="min-w-[7rem] flex-1 basis-28">
          <div
            className="h-1.5 rounded-full bg-primary"
            style={{ opacity: n > 1 ? 0.35 + (0.65 * i) / (n - 1) : 1 }}
            aria-hidden
          />
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-semibold tabular-nums leading-none">
              {level.ordinal}
            </span>
            <span className="text-sm font-medium leading-tight">
              {level.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Expected-level marker on a mini proficiency rail (for expectation-set items). */
function MiniExpectedTrack({
  levelCount,
  expected,
}: {
  levelCount: number;
  expected: number;
}) {
  const pct = levelCount > 1 ? ((expected - 1) / (levelCount - 1)) * 100 : 50;
  return (
    <div className="relative h-4 w-28 shrink-0">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
      <span
        aria-hidden
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-amber-600 bg-background dark:border-amber-400"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

// ─── Catalogue tab: skills grouped by category, categories managed inline ────

function CatalogueTab({
  api,
  categories,
  skills,
  refetch,
}: {
  api: Api;
  categories: SkillCategoryDto[];
  skills: SkillDto[];
  refetch: () => Promise<unknown>;
}) {
  const [editSkill, setEditSkill] = useState<SkillDto | "new" | null>(null);
  const [editCategory, setEditCategory] = useState<
    SkillCategoryDto | "new" | null
  >(null);

  const activeCategories = categories.filter((c) => c.status === "Active");
  const byCategory = new Map<string, SkillDto[]>();
  for (const skill of skills) {
    const bucket = byCategory.get(skill.categoryId) ?? [];
    bucket.push(skill);
    byCategory.set(skill.categoryId, bucket);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Catalogue</h2>
          <p className="text-sm text-muted-foreground">
            {skills.length} skills across {activeCategories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditCategory("new")}>
            <Plus data-icon="inline-start" />
            Category
          </Button>
          <Button onClick={() => setEditSkill("new")}>
            <Plus data-icon="inline-start" />
            Skill
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <PageEmpty
          title="No categories yet"
          action={
            <Button onClick={() => setEditCategory("new")}>
              <Plus data-icon="inline-start" />
              Create category
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {categories.map((category) => {
            const categorySkills = byCategory.get(category.id) ?? [];
            const blocked = categorySkills.some((s) => s.status === "Active");
            return (
              <section key={category.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {category.name}
                    </h3>
                    <span className="text-xs tabular-nums text-muted-foreground/70">
                      {category.activeSkillCount}
                    </span>
                    {category.status !== "Active" ? (
                      <Life status={category.status} />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditCategory(category)}
                    >
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                    {category.status === "Active" && !blocked ? (
                      <ArchiveAction
                        onClick={async () => {
                          await api.post(
                            performancePaths.skillCategoryArchive(category.id),
                            {}
                          );
                          toast.success("Category archived");
                          await refetch();
                        }}
                      />
                    ) : null}
                  </div>
                </div>
                {categorySkills.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">
                    No skills in this category yet.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {categorySkills.map((skill) => (
                      <div
                        key={skill.id}
                        className="group flex items-center gap-3 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 flex-1 items-baseline gap-2">
                          <span className="shrink-0 font-medium">
                            {skill.name}
                          </span>
                          {skill.description ? (
                            <span className="min-w-0 truncate text-sm text-muted-foreground">
                              {skill.description}
                            </span>
                          ) : null}
                        </div>
                        <Life status={skill.status} inUse={skill.isInUse} />
                        <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${skill.name}`}
                            disabled={skill.isInUse}
                            onClick={() => setEditSkill(skill)}
                          >
                            <Pencil />
                          </Button>
                          {skill.status === "Active" ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Archive ${skill.name}`}
                              onClick={async () => {
                                await api.post(
                                  performancePaths.skillArchive(skill.id),
                                  {}
                                );
                                toast.success("Skill archived");
                                await refetch();
                              }}
                            >
                              <Archive />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <CategoryDialog
        api={api}
        value={editCategory}
        skills={skills}
        onClose={() => setEditCategory(null)}
        onSaved={async () => {
          setEditCategory(null);
          await refetch();
        }}
      />
      <SkillDialog
        api={api}
        value={editSkill}
        categories={categories}
        onClose={() => setEditSkill(null)}
        onSaved={async () => {
          setEditSkill(null);
          await refetch();
        }}
      />
    </div>
  );
}

function ScaleGroup({
  api,
  items,
  refetch,
}: {
  api: Api;
  items: ProficiencyScaleDto[];
  refetch: () => Promise<unknown>;
}) {
  const [edit, setEdit] = useState<ProficiencyScaleDto | "new" | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <GroupHeader
        title="Proficiency scales"
        count={items.length}
        onNew={() => setEdit("new")}
      />
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-4 rounded-2xl border border-border p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.name}</p>
                {item.description ? (
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <Life status={item.status} inUse={item.isInUse} />
            </div>
            <ScaleSpine levels={item.levels} />
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={item.isInUse}
                onClick={() => setEdit(item)}
              >
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await api.post(
                    performancePaths.proficiencyScaleDuplicate(item.id),
                    { name: `${item.name} copy` }
                  );
                  toast.success("Scale duplicated");
                  await refetch();
                }}
              >
                <Copy data-icon="inline-start" />
                Duplicate
              </Button>
              {item.status === "Draft" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await api.post(
                      performancePaths.proficiencyScaleStatus(item.id),
                      { status: "Active" }
                    );
                    toast.success("Scale activated");
                    await refetch();
                  }}
                >
                  Activate
                </Button>
              ) : item.status === "Active" ? (
                <ArchiveAction
                  onClick={async () => {
                    await api.post(
                      performancePaths.proficiencyScaleStatus(item.id),
                      { status: "Archived" }
                    );
                    toast.success("Scale archived");
                    await refetch();
                  }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 ? (
        <PageEmpty
          title="No proficiency scales"
          action={
            <Button onClick={() => setEdit("new")}>
              <Plus data-icon="inline-start" />
              Create scale
            </Button>
          }
        />
      ) : null}
      <ScaleDialog
        api={api}
        value={edit}
        onClose={() => setEdit(null)}
        onSaved={async () => {
          setEdit(null);
          await refetch();
        }}
      />
    </div>
  );
}

function SetGroup({
  api,
  items,
  scales,
  skills,
  refetch,
}: {
  api: Api;
  items: SkillExpectationSetDto[];
  scales: ProficiencyScaleDto[];
  skills: SkillDto[];
  refetch: () => Promise<unknown>;
}) {
  const [edit, setEdit] = useState<SkillExpectationSetDto | "new" | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <GroupHeader
        title="Expectation sets"
        count={items.length}
        onNew={() => setEdit("new")}
      />
      <div className="flex flex-col gap-4">
        {items.map((item) => {
          const scale = scales.find((s) => s.id === item.proficiencyScaleId);
          const levelCount = scale?.levels.length ?? item.items.length;
          return (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-2xl border border-border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.items.length} skills · {item.proficiencyScaleName}
                  </p>
                </div>
                <Life status={item.status} inUse={item.isInUse} />
              </div>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {item.items.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between gap-4 px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {line.skillName}
                    </span>
                    <MiniExpectedTrack
                      levelCount={levelCount}
                      expected={line.expectedLevelOrdinal}
                    />
                    <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                      {line.expectedLevelLabel}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={item.isInUse}
                  onClick={() => setEdit(item)}
                >
                  <Pencil data-icon="inline-start" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await api.post(
                      performancePaths.skillExpectationSetDuplicate(item.id),
                      { name: `${item.name} copy` }
                    );
                    toast.success("Set duplicated");
                    await refetch();
                  }}
                >
                  <Copy data-icon="inline-start" />
                  Duplicate
                </Button>
                {item.status === "Draft" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await api.post(
                        performancePaths.skillExpectationSetStatus(item.id),
                        { status: "Active" }
                      );
                      toast.success("Set activated");
                      await refetch();
                    }}
                  >
                    Activate
                  </Button>
                ) : item.status === "Active" ? (
                  <ArchiveAction
                    onClick={async () => {
                      await api.post(
                        performancePaths.skillExpectationSetStatus(item.id),
                        { status: "Archived" }
                      );
                      toast.success("Set archived");
                      await refetch();
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 ? (
        <PageEmpty
          title="No expectation sets"
          action={
            <Button onClick={() => setEdit("new")}>
              <Plus data-icon="inline-start" />
              Create set
            </Button>
          }
        />
      ) : null}
      <SetDialog
        api={api}
        value={edit}
        scales={scales}
        skills={skills}
        onClose={() => setEdit(null)}
        onSaved={async () => {
          setEdit(null);
          await refetch();
        }}
      />
    </div>
  );
}

// ─── Dialogs (create/edit) ────────────────────────────────────────────────────

function CategoryDialog({
  api,
  value,
  skills,
  onClose,
  onSaved,
}: {
  api: Api;
  value: SkillCategoryDto | "new" | null;
  skills: SkillDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(value && value !== "new" ? value.name : "");
  const save = useApiMutation<SkillCategoryDto, SkillNameRequest>(
    (body) =>
      value && value !== "new"
        ? api.put(performancePaths.skillCategory(value.id), body)
        : api.post(performancePaths.skillCategories(), body),
    { onSuccess: onSaved, onError: () => { toast.error("Could not save the category."); } }
  );
  if (!value) return null;
  const blocked =
    value !== "new" &&
    skills.some((skill) => skill.categoryId === value.id && skill.status === "Active");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {value === "new" ? "New category" : "Edit category"}
          </DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="category-name">Name</FieldLabel>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {blocked ? (
          <Alert>
            <AlertTitle>Category has active skills</AlertTitle>
            <AlertDescription>
              Archive active skills before archiving this category.
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || save.isLoading}
            onClick={() => save.mutate({ name })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillDialog({
  api,
  value,
  categories,
  onClose,
  onSaved,
}: {
  api: Api;
  value: SkillDto | "new" | null;
  categories: SkillCategoryDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<SkillWriteRequest>({
    name: value && value !== "new" ? value.name : "",
    description: value && value !== "new" ? value.description : "",
    categoryId:
      value && value !== "new" ? value.categoryId : (categories[0]?.id ?? ""),
  });
  const save = useApiMutation<SkillDto, SkillWriteRequest>(
    (body) =>
      value && value !== "new"
        ? api.put(performancePaths.skill(value.id), body)
        : api.post(performancePaths.skills(), body),
    { onSuccess: onSaved, onError: () => { toast.error("Could not save the skill."); } }
  );
  if (!value) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{value === "new" ? "New skill" : "Edit skill"}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="skill-name">Name</FieldLabel>
            <Input
              id="skill-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="skill-category">Category</FieldLabel>
            <NativeSelect
              id="skill-category"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categories
                .filter((x) => x.status === "Active")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="skill-description">Description</FieldLabel>
            <Textarea
              id="skill-description"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!form.name.trim() || !form.categoryId || save.isLoading}
            onClick={() => save.mutate(form)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScaleDialog({
  api,
  value,
  onClose,
  onSaved,
}: {
  api: Api;
  value: ProficiencyScaleDto | "new" | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ProficiencyScaleWriteRequest>({
    name: value && value !== "new" ? value.name : "",
    description: value && value !== "new" ? value.description : "",
    levels:
      value && value !== "new"
        ? value.levels.map((x) => ({
            id: x.id,
            label: x.label,
            description: x.description,
          }))
        : ["Foundational", "Developing", "Proficient", "Advanced", "Expert"].map(
            (label) => ({ label, description: "" })
          ),
  });
  const save = useApiMutation<ProficiencyScaleDto, ProficiencyScaleWriteRequest>(
    (body) =>
      value && value !== "new"
        ? api.put(performancePaths.proficiencyScale(value.id), body)
        : api.post(performancePaths.proficiencyScales(), body),
    { onSuccess: onSaved, onError: () => { toast.error("Could not save the scale."); } }
  );
  if (!value) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {value === "new" ? "New proficiency scale" : "Edit proficiency scale"}
          </DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="scale-name">Name</FieldLabel>
            <Input
              id="scale-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="scale-description">Description</FieldLabel>
            <Textarea
              id="scale-description"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel>Ordered levels</FieldLabel>
              <Button
                variant="outline"
                size="sm"
                disabled={form.levels.length >= 7}
                onClick={() =>
                  setForm({
                    ...form,
                    levels: [
                      ...form.levels,
                      { label: "New level", description: "" },
                    ],
                  })
                }
              >
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.levels.map((level, i) => (
                <div
                  key={level.id ?? i}
                  className="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2"
                >
                  <span className="text-sm font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <Input
                    aria-label={`Level ${i + 1} label`}
                    value={level.label}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        levels: form.levels.map((x, j) =>
                          j === i ? { ...x, label: e.target.value } : x
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label={`Level ${i + 1} description`}
                    value={level.description ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        levels: form.levels.map((x, j) =>
                          j === i ? { ...x, description: e.target.value } : x
                        ),
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={form.levels.length <= 3}
                    onClick={() =>
                      setForm({
                        ...form,
                        levels: form.levels.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !form.name.trim() || form.levels.length < 3 || save.isLoading
            }
            onClick={() => save.mutate(form)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetDialog({
  api,
  value,
  scales,
  skills,
  onClose,
  onSaved,
}: {
  api: Api;
  value: SkillExpectationSetDto | "new" | null;
  scales: ProficiencyScaleDto[];
  skills: SkillDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialScale =
    value && value !== "new"
      ? scales.find((x) => x.id === value.proficiencyScaleId)
      : scales.find((x) => x.status === "Active");
  const [form, setForm] = useState<SkillExpectationSetWriteRequest>({
    name: value && value !== "new" ? value.name : "",
    description: value && value !== "new" ? value.description : "",
    proficiencyScaleId:
      value && value !== "new"
        ? value.proficiencyScaleId
        : (initialScale?.id ?? ""),
    items:
      value && value !== "new"
        ? value.items.map((x) => ({
            skillId: x.skillId,
            expectedLevelOrdinal: x.expectedLevelOrdinal,
          }))
        : [],
  });
  const save = useApiMutation<
    SkillExpectationSetDto,
    SkillExpectationSetWriteRequest
  >(
    (body) =>
      value && value !== "new"
        ? api.put(performancePaths.skillExpectationSet(value.id), body)
        : api.post(performancePaths.skillExpectationSets(), body),
    { onSuccess: onSaved, onError: () => { toast.error("Could not save the set."); } }
  );
  if (!value) return null;
  const scale = scales.find((x) => x.id === form.proficiencyScaleId);
  const activeSkills = skills.filter((x) => x.status === "Active");
  const toggle = (skillId: string) =>
    setForm({
      ...form,
      items: form.items.some((x) => x.skillId === skillId)
        ? form.items.filter((x) => x.skillId !== skillId)
        : [
            ...form.items,
            {
              skillId,
              expectedLevelOrdinal: Math.ceil((scale?.levels.length ?? 3) / 2),
            },
          ],
    });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {value === "new" ? "New expectation set" : "Edit expectation set"}
          </DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="set-name">Name</FieldLabel>
            <Input
              id="set-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="set-scale">Proficiency scale</FieldLabel>
            <NativeSelect
              id="set-scale"
              value={form.proficiencyScaleId}
              onChange={(e) =>
                setForm({ ...form, proficiencyScaleId: e.target.value })
              }
            >
              {scales
                .filter((x) => x.status === "Active")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel>Skills</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeSkills.map((skill) => {
                const item = form.items.find((x) => x.skillId === skill.id);
                return (
                  <div
                    key={skill.id}
                    className={cn(
                      "rounded-xl border p-3",
                      item ? "border-primary/40 bg-primary/5" : "border-border"
                    )}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() => toggle(skill.id)}
                    >
                      <span>
                        <span className="block font-medium">{skill.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {skill.categoryName}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "size-4 rounded-full border",
                          item
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        )}
                        aria-hidden
                      />
                    </button>
                    {item && scale ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {scale.levels.map((level) => (
                          <button
                            key={level.ordinal}
                            type="button"
                            aria-pressed={
                              item.expectedLevelOrdinal === level.ordinal
                            }
                            onClick={() =>
                              setForm({
                                ...form,
                                items: form.items.map((x) =>
                                  x.skillId === skill.id
                                    ? {
                                        ...x,
                                        expectedLevelOrdinal: level.ordinal,
                                      }
                                    : x
                                ),
                              })
                            }
                            className={cn(
                              "flex-1 rounded-md border px-1.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              item.expectedLevelOrdinal === level.ordinal
                                ? "border-primary bg-primary/10"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            )}
                          >
                            {level.ordinal}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !form.name.trim() ||
              !form.proficiencyScaleId ||
              form.items.length === 0 ||
              save.isLoading
            }
            onClick={() => save.mutate(form)}
          >
            Save set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
