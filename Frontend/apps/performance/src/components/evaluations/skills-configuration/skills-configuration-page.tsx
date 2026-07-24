"use client";

import { useMemo, useState } from "react";
import { Archive, BrainCircuit, Copy, Pencil, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { createPlatformApiClient, performancePaths, performanceQueryKeys } from "@repo/api";
import type {
  ProficiencyScaleDto, ProficiencyScaleWriteRequest, SkillCategoryDto, SkillDto, SkillExpectationSetDto,
  SkillExpectationSetWriteRequest, SkillNameRequest, SkillWriteRequest, SkillsConfigurationWorkspaceDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { canManageSkills, useAuth } from "@repo/auth";
import { PageContainer, PageEmpty, PageError, PageHeader, PageLoading, PagePermissionNotice, StatusBadge } from "@repo/ds/shell";
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Field, FieldGroup, FieldLabel, Input, NativeSelect, Textarea } from "@repo/ds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Group = "categories" | "skills" | "scales" | "sets";
type Api = ReturnType<typeof createPlatformApiClient>;

export function SkillsConfigurationPage() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const allowed = canManageSkills(user);
  const workspace = useApiQuery<SkillsConfigurationWorkspaceDto>(
    performanceQueryKeys.skillsWorkspace(), (signal) => api.get(performancePaths.skillsWorkspace(), { signal }), { enabled: allowed },
  );
  const [group, setGroup] = useState<Group>("categories");

  if (authLoading) return <PageContainer><PageLoading label="Checking skills access" /></PageContainer>;
  if (!allowed) return <PageContainer><PagePermissionNotice title="Skills unavailable" description="Skills management permission is required." /></PageContainer>;
  if (workspace.isLoading) return <PageContainer width="wide"><PageHeader title="Skills" /><PageLoading /></PageContainer>;
  if (workspace.error || !workspace.data) return <PageContainer width="wide"><PageError title="Skills could not be loaded" description="No values were changed." onRetry={workspace.refetch} /></PageContainer>;

  const data = workspace.data;
  return <PageContainer width="wide">
    <PageHeader title="Skills" />
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Skills configuration">
        {([ ["categories", "Categories", data.categories.length], ["skills", "Skills", data.skills.length], ["scales", "Proficiency scales", data.proficiencyScales.length], ["sets", "Expectation sets", data.expectationSets.length] ] as const).map(([value, label, count]) => (
          <button key={value} type="button" role="tab" aria-selected={group === value} onClick={() => setGroup(value)} className={cn("rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", group === value ? "border-primary/40 bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
            {label}<span className="ml-2 text-xs tabular-nums text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>
      {group === "categories" ? <CategoryGroup api={api} items={data.categories} skills={data.skills} refetch={workspace.refetch} /> : null}
      {group === "skills" ? <SkillGroup api={api} items={data.skills} categories={data.categories} refetch={workspace.refetch} /> : null}
      {group === "scales" ? <ScaleGroup api={api} items={data.proficiencyScales} refetch={workspace.refetch} /> : null}
      {group === "sets" ? <SetGroup api={api} items={data.expectationSets} scales={data.proficiencyScales} skills={data.skills} refetch={workspace.refetch} /> : null}
    </div>
  </PageContainer>;
}

function GroupHeader({ title, count, onNew, action = "New" }: { title: string; count: number; onNew: () => void; action?: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{count} configured</p></div><Button onClick={onNew}><Plus data-icon="inline-start" />{action}</Button></div>;
}

function Life({ status, inUse }: { status: string; inUse?: boolean }) {
  if (inUse) return <StatusBadge tone="info">In use</StatusBadge>;
  return <StatusBadge tone={status === "Active" ? "success" : "muted"}>{status}</StatusBadge>;
}

function CategoryGroup({ api, items, skills, refetch }: { api: Api; items: SkillCategoryDto[]; skills: SkillDto[]; refetch: () => Promise<unknown> }) {
  const [edit, setEdit] = useState<SkillCategoryDto | "new" | null>(null);
  return <div className="flex flex-col gap-4"><GroupHeader title="Categories" count={items.length} onNew={() => setEdit("new")} /><div className="divide-y rounded-xl border border-border">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.activeSkillCount} active skills</p></div><div className="flex items-center gap-2"><Life status={item.status} /><Button variant="ghost" size="sm" onClick={() => setEdit(item)}><Pencil data-icon="inline-start" />Edit</Button>{item.status === "Active" ? <ArchiveAction onClick={async () => { await api.post(performancePaths.skillCategoryArchive(item.id), {}); toast.success("Category archived"); await refetch(); }} /> : null}</div></div>)}</div>{items.length === 0 ? <PageEmpty title="No categories" action={<Button onClick={() => setEdit("new")}><Plus data-icon="inline-start" />Create category</Button>} /> : null}<CategoryDialog api={api} value={edit} skills={skills} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await refetch(); }} /></div>;
}

function SkillGroup({ api, items, categories, refetch }: { api: Api; items: SkillDto[]; categories: SkillCategoryDto[]; refetch: () => Promise<unknown> }) {
  const [edit, setEdit] = useState<SkillDto | "new" | null>(null);
  return <div className="flex flex-col gap-4"><GroupHeader title="Skills" count={items.length} onNew={() => setEdit("new")} /><div className="grid gap-3 md:grid-cols-2">{items.map((item) => <div key={item.id} className="flex min-h-28 flex-col justify-between rounded-xl border border-border p-4"><div><div className="flex items-start justify-between gap-2"><p className="font-medium">{item.name}</p><Life status={item.status} inUse={item.isInUse} /></div><p className="mt-1 text-sm text-muted-foreground">{item.categoryName}</p>{item.description ? <p className="mt-2 line-clamp-2 text-sm">{item.description}</p> : null}</div><div className="mt-3 flex gap-2"><Button variant="ghost" size="sm" disabled={item.isInUse} onClick={() => setEdit(item)}><Pencil data-icon="inline-start" />Edit</Button>{item.status === "Active" ? <ArchiveAction onClick={async () => { await api.post(performancePaths.skillArchive(item.id), {}); toast.success("Skill archived"); await refetch(); }} /> : null}</div></div>)}</div>{items.length === 0 ? <PageEmpty title="No skills" action={<Button onClick={() => setEdit("new")}><Plus data-icon="inline-start" />Create skill</Button>} /> : null}<SkillDialog api={api} value={edit} categories={categories} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await refetch(); }} /></div>;
}

function ScaleGroup({ api, items, refetch }: { api: Api; items: ProficiencyScaleDto[]; refetch: () => Promise<unknown> }) {
  const [edit, setEdit] = useState<ProficiencyScaleDto | "new" | null>(null);
  return <div className="flex flex-col gap-4"><GroupHeader title="Proficiency scales" count={items.length} onNew={() => setEdit("new")} /><div className="flex flex-col gap-3">{items.map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-4 pt-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{item.name}</p>{item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}</div><Life status={item.status} inUse={item.isInUse} /></div><LevelTrack levels={item.levels} /><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={item.isInUse} onClick={() => setEdit(item)}><Pencil data-icon="inline-start" />Edit</Button><Button variant="ghost" size="sm" onClick={async () => { await api.post(performancePaths.proficiencyScaleDuplicate(item.id), { name: `${item.name} copy` }); toast.success("Scale duplicated"); await refetch(); }}><Copy data-icon="inline-start" />Duplicate</Button>{item.status === "Draft" ? <Button variant="outline" size="sm" onClick={async () => { await api.post(performancePaths.proficiencyScaleStatus(item.id), { status: "Active" }); toast.success("Scale activated"); await refetch(); }}>Activate</Button> : item.status === "Active" ? <ArchiveAction onClick={async () => { await api.post(performancePaths.proficiencyScaleStatus(item.id), { status: "Archived" }); toast.success("Scale archived"); await refetch(); }} /> : null}</div></CardContent></Card>)}</div>{items.length === 0 ? <PageEmpty title="No proficiency scales" action={<Button onClick={() => setEdit("new")}><Plus data-icon="inline-start" />Create scale</Button>} /> : null}<ScaleDialog api={api} value={edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await refetch(); }} /></div>;
}

function SetGroup({ api, items, scales, skills, refetch }: { api: Api; items: SkillExpectationSetDto[]; scales: ProficiencyScaleDto[]; skills: SkillDto[]; refetch: () => Promise<unknown> }) {
  const [edit, setEdit] = useState<SkillExpectationSetDto | "new" | null>(null);
  return <div className="flex flex-col gap-4"><GroupHeader title="Expectation sets" count={items.length} onNew={() => setEdit("new")} /><div className="flex flex-col gap-3">{items.map((item) => { const scale = scales.find((s) => s.id === item.proficiencyScaleId); return <Card key={item.id}><CardContent className="flex flex-col gap-4 pt-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">{item.items.length} skills · {item.proficiencyScaleName}</p></div><Life status={item.status} inUse={item.isInUse} /></div><div className="flex flex-wrap gap-2">{item.items.map((line) => <Badge key={line.id} variant="outline">{line.skillName} · {line.expectedLevelLabel}</Badge>)}</div><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={item.isInUse} onClick={() => setEdit(item)}><Pencil data-icon="inline-start" />Edit</Button><Button variant="ghost" size="sm" onClick={async () => { await api.post(performancePaths.skillExpectationSetDuplicate(item.id), { name: `${item.name} copy` }); toast.success("Set duplicated"); await refetch(); }}><Copy data-icon="inline-start" />Duplicate</Button>{item.status === "Draft" ? <Button variant="outline" size="sm" onClick={async () => { await api.post(performancePaths.skillExpectationSetStatus(item.id), { status: "Active" }); toast.success("Set activated"); await refetch(); }}>Activate</Button> : item.status === "Active" ? <ArchiveAction onClick={async () => { await api.post(performancePaths.skillExpectationSetStatus(item.id), { status: "Archived" }); toast.success("Set archived"); await refetch(); }} /> : null}</div></CardContent></Card>; })}</div>{items.length === 0 ? <PageEmpty title="No expectation sets" action={<Button onClick={() => setEdit("new")}><Plus data-icon="inline-start" />Create set</Button>} /> : null}<SetDialog api={api} value={edit} scales={scales} skills={skills} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await refetch(); }} /></div>;
}

function LevelTrack({ levels, selected, onSelect }: { levels: Array<{ ordinal: number; label: string; description?: string | null }>; selected?: number; onSelect?: (ordinal: number) => void }) {
  return <div className="flex w-full gap-1" role={onSelect ? "radiogroup" : undefined}>{levels.map((level) => <button key={level.ordinal} type="button" disabled={!onSelect} onClick={() => onSelect?.(level.ordinal)} aria-pressed={selected === level.ordinal} className={cn("flex min-w-0 flex-1 flex-col gap-1 rounded-lg border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected === level.ordinal ? "border-primary bg-primary/10" : "border-border bg-muted/30", onSelect ? "hover:border-primary/50" : "cursor-default")}><span className="text-lg font-semibold tabular-nums">{level.ordinal}</span><span className="truncate text-xs font-medium">{level.label}</span></button>)}</div>;
}

function ArchiveAction({ onClick }: { onClick: () => void }) { return <Button variant="ghost" size="sm" onClick={onClick}><Archive data-icon="inline-start" />Archive</Button>; }

function CategoryDialog({ api, value, skills, onClose, onSaved }: { api: Api; value: SkillCategoryDto | "new" | null; skills: SkillDto[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(value && value !== "new" ? value.name : "");
  const save = useApiMutation<SkillCategoryDto, SkillNameRequest>((body) => value && value !== "new" ? api.put(performancePaths.skillCategory(value.id), body) : api.post(performancePaths.skillCategories(), body), { onSuccess: onSaved });
  if (!value) return null; const blocked = value !== "new" && skills.some((skill) => skill.categoryId === value.id && skill.status === "Active");
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{value === "new" ? "New category" : "Edit category"}</DialogTitle></DialogHeader><Field><FieldLabel htmlFor="category-name">Name</FieldLabel><Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>{blocked ? <Alert><ShieldCheck /><AlertTitle>Category has active skills</AlertTitle><AlertDescription>Archive active skills before archiving this category.</AlertDescription></Alert> : null}<DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!name.trim() || save.isLoading} onClick={() => save.mutate({ name })}>Save</Button></DialogFooter></DialogContent></Dialog>;
}

function SkillDialog({ api, value, categories, onClose, onSaved }: { api: Api; value: SkillDto | "new" | null; categories: SkillCategoryDto[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<SkillWriteRequest>({ name: value && value !== "new" ? value.name : "", description: value && value !== "new" ? value.description : "", categoryId: value && value !== "new" ? value.categoryId : categories[0]?.id ?? "" });
  const save = useApiMutation<SkillDto, SkillWriteRequest>((body) => value && value !== "new" ? api.put(performancePaths.skill(value.id), body) : api.post(performancePaths.skills(), body), { onSuccess: onSaved });
  if (!value) return null;
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{value === "new" ? "New skill" : "Edit skill"}</DialogTitle></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="skill-name">Name</FieldLabel><Input id="skill-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field><FieldLabel htmlFor="skill-category">Category</FieldLabel><NativeSelect id="skill-category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.filter((x) => x.status === "Active").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field><Field><FieldLabel htmlFor="skill-description">Description</FieldLabel><Textarea id="skill-description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!form.name.trim() || !form.categoryId || save.isLoading} onClick={() => save.mutate(form)}>Save</Button></DialogFooter></DialogContent></Dialog>;
}

function ScaleDialog({ api, value, onClose, onSaved }: { api: Api; value: ProficiencyScaleDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ProficiencyScaleWriteRequest>({ name: value && value !== "new" ? value.name : "", description: value && value !== "new" ? value.description : "", levels: value && value !== "new" ? value.levels.map((x) => ({ id: x.id, label: x.label, description: x.description })) : ["Foundational", "Developing", "Proficient", "Advanced", "Expert"].map((label) => ({ label, description: "" })) });
  const save = useApiMutation<ProficiencyScaleDto, ProficiencyScaleWriteRequest>((body) => value && value !== "new" ? api.put(performancePaths.proficiencyScale(value.id), body) : api.post(performancePaths.proficiencyScales(), body), { onSuccess: onSaved });
  if (!value) return null;
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{value === "new" ? "New proficiency scale" : "Edit proficiency scale"}</DialogTitle></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="scale-name">Name</FieldLabel><Input id="scale-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field><FieldLabel htmlFor="scale-description">Description</FieldLabel><Textarea id="scale-description" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><Field><div className="flex items-center justify-between"><FieldLabel>Ordered levels</FieldLabel><Button variant="outline" size="sm" disabled={form.levels.length >= 7} onClick={() => setForm({ ...form, levels: [...form.levels, { label: "New level", description: "" }] })}><Plus data-icon="inline-start" />Add</Button></div><div className="flex flex-col gap-2">{form.levels.map((level, i) => <div key={level.id ?? i} className="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2"><span className="text-sm font-semibold tabular-nums">{i + 1}</span><Input aria-label={`Level ${i + 1} label`} value={level.label} onChange={(e) => setForm({ ...form, levels: form.levels.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} /><Input aria-label={`Level ${i + 1} description`} value={level.description ?? ""} onChange={(e) => setForm({ ...form, levels: form.levels.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} /><Button variant="ghost" size="sm" disabled={form.levels.length <= 3} onClick={() => setForm({ ...form, levels: form.levels.filter((_, j) => j !== i) })}>Remove</Button></div>)}</div></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!form.name.trim() || form.levels.length < 3 || save.isLoading} onClick={() => save.mutate(form)}>Save</Button></DialogFooter></DialogContent></Dialog>;
}

function SetDialog({ api, value, scales, skills, onClose, onSaved }: { api: Api; value: SkillExpectationSetDto | "new" | null; scales: ProficiencyScaleDto[]; skills: SkillDto[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const initialScale = value && value !== "new" ? scales.find((x) => x.id === value.proficiencyScaleId) : scales.find((x) => x.status === "Active");
  const [form, setForm] = useState<SkillExpectationSetWriteRequest>({ name: value && value !== "new" ? value.name : "", description: value && value !== "new" ? value.description : "", proficiencyScaleId: value && value !== "new" ? value.proficiencyScaleId : initialScale?.id ?? "", items: value && value !== "new" ? value.items.map((x) => ({ skillId: x.skillId, expectedLevelOrdinal: x.expectedLevelOrdinal })) : [] });
  const save = useApiMutation<SkillExpectationSetDto, SkillExpectationSetWriteRequest>((body) => value && value !== "new" ? api.put(performancePaths.skillExpectationSet(value.id), body) : api.post(performancePaths.skillExpectationSets(), body), { onSuccess: onSaved });
  if (!value) return null; const scale = scales.find((x) => x.id === form.proficiencyScaleId); const activeSkills = skills.filter((x) => x.status === "Active");
  const toggle = (skillId: string) => setForm({ ...form, items: form.items.some((x) => x.skillId === skillId) ? form.items.filter((x) => x.skillId !== skillId) : [...form.items, { skillId, expectedLevelOrdinal: Math.ceil((scale?.levels.length ?? 3) / 2) }] });
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{value === "new" ? "New expectation set" : "Edit expectation set"}</DialogTitle></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="set-name">Name</FieldLabel><Input id="set-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field><FieldLabel htmlFor="set-scale">Proficiency scale</FieldLabel><NativeSelect id="set-scale" value={form.proficiencyScaleId} onChange={(e) => setForm({ ...form, proficiencyScaleId: e.target.value })}>{scales.filter((x) => x.status === "Active").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field><Field><FieldLabel>Skills</FieldLabel><div className="grid gap-2 sm:grid-cols-2">{activeSkills.map((skill) => { const item = form.items.find((x) => x.skillId === skill.id); return <div key={skill.id} className={cn("rounded-xl border p-3", item ? "border-primary/40 bg-primary/5" : "border-border")}><button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => toggle(skill.id)}><span><span className="block font-medium">{skill.name}</span><span className="text-xs text-muted-foreground">{skill.categoryName}</span></span><span className={cn("size-4 rounded-full border", item ? "border-primary bg-primary" : "border-muted-foreground/40")} aria-hidden /></button>{item && scale ? <div className="mt-3"><LevelTrack levels={scale.levels} selected={item.expectedLevelOrdinal} onSelect={(ordinal) => setForm({ ...form, items: form.items.map((x) => x.skillId === skill.id ? { ...x, expectedLevelOrdinal: ordinal } : x) })} /></div> : null}</div>; })}</div></Field></FieldGroup><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!form.name.trim() || !form.proficiencyScaleId || form.items.length === 0 || save.isLoading} onClick={() => save.mutate(form)}>Save set</Button></DialogFooter></DialogContent></Dialog>;
}
