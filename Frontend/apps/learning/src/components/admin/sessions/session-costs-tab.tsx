"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getPartsForTraining, updateSession } from "@/services/admin-sessions-service";
import { formatCurrency } from "@/lib/utils";
import type { AdminTrainingPart, AdminTrainingSession, UpdateSessionInput } from "@/types/admin";

interface SessionCostsTabProps {
  trainingId: string;
}

interface CostDraft {
  externalTrainerCost: string;
  venueCost: string;
  materialsCost: string;
  otherCost: string;
}

const EMPTY_DRAFT: CostDraft = { externalTrainerCost: "", venueCost: "", materialsCost: "", otherCost: "" };
const COST_FIELDS = ["externalTrainerCost", "venueCost", "materialsCost", "otherCost"] as const;

function toDraft(s: AdminTrainingSession): CostDraft {
  return {
    externalTrainerCost: s.externalTrainerCost?.toString() ?? "",
    venueCost: s.venueCost?.toString() ?? "",
    materialsCost: s.materialsCost?.toString() ?? "",
    otherCost: s.otherCost?.toString() ?? "",
  };
}

function num(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function draftTotal(d: CostDraft): number {
  return (num(d.externalTrainerCost) ?? 0) + (num(d.venueCost) ?? 0) + (num(d.materialsCost) ?? 0) + (num(d.otherCost) ?? 0);
}

export function SessionCostsTab({ trainingId }: SessionCostsTabProps) {
  const fetchParts = useCallback(() => getPartsForTraining(trainingId), [trainingId]);
  const { data: parts, isLoading, refetch } = useApiQuery<AdminTrainingPart[]>(fetchParts, { enabled: true });

  const [drafts, setDrafts] = useState<Record<string, CostDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!parts) return;
    const next: Record<string, CostDraft> = {};
    for (const p of parts) for (const s of p.sessions) next[s.id] = toDraft(s);
    setDrafts(next);
  }, [parts]);

  const { mutateAsync: doUpdate } = useApiMutation(
    (args: { sessionId: string; input: UpdateSessionInput }) => updateSession(args.sessionId, args.input),
  );

  function setField(sessionId: string, field: keyof CostDraft, value: string) {
    setDrafts((prev) => ({ ...prev, [sessionId]: { ...(prev[sessionId] ?? EMPTY_DRAFT), [field]: value } }));
  }

  function isLocked(s: AdminTrainingSession, partLocked: boolean): boolean {
    return partLocked || s.status === "Completed" || s.status === "Cancelled" || new Date(s.endUtc) < new Date();
  }

  async function handleSave(s: AdminTrainingSession) {
    const d = drafts[s.id] ?? toDraft(s);
    setSavingId(s.id);
    setError(null);
    try {
      // updateSession requires the full schedule payload — resend the session's existing fields.
      await doUpdate({
        sessionId: s.id,
        input: {
          startUtc: s.startUtc,
          endUtc: s.endUtc,
          room: s.room,
          maxCapacity: s.maxCapacity,
          notes: s.notes ?? undefined,
          trainerEmployeeId: s.trainerEmployeeId ?? undefined,
          trainerName: s.trainerName ?? undefined,
          trainerEmail: s.trainerEmail ?? undefined,
          externalTrainerCost: num(d.externalTrainerCost),
          venueCost: num(d.venueCost),
          materialsCost: num(d.materialsCost),
          otherCost: num(d.otherCost),
        },
      });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save costs.");
    } finally {
      setSavingId(null);
    }
  }

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading costs...</div>;
  }

  const allSessions = (parts ?? []).flatMap((p) => p.sessions);
  if (allSessions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No sessions yet. Add sessions under the Sessions tab to record their costs.
      </div>
    );
  }

  const grandTotal = allSessions.reduce((sum, s) => sum + draftTotal(drafts[s.id] ?? toDraft(s)), 0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {(parts ?? []).map((part) => (
        <div key={part.id} className="overflow-hidden rounded-lg border border-border/60">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2">
            <span className="text-sm font-semibold text-foreground">{part.title}</span>
            {part.isLocked && <span className="text-xs text-muted-foreground">Locked</span>}
          </div>
          {part.sessions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No sessions in this part.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-right">Trainer</TableHead>
                  <TableHead className="text-right">Venue</TableHead>
                  <TableHead className="text-right">Materials</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {part.sessions.map((s) => {
                  const d = drafts[s.id] ?? toDraft(s);
                  const locked = isLocked(s, part.isLocked);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.startUtc).toLocaleDateString()} · {s.room}
                        {s.trainerName ? ` · ${s.trainerName}` : ""}
                      </TableCell>
                      {COST_FIELDS.map((field) => (
                        <TableCell key={field} className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.001"
                            disabled={locked}
                            value={d[field]}
                            onChange={(e) => setField(s.id, field, e.target.value)}
                            className="ml-auto h-8 w-24 text-right"
                            aria-label={`${field} for session on ${new Date(s.startUtc).toLocaleDateString()}`}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium">{formatCurrency(draftTotal(d))}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={locked || savingId === s.id}
                          onClick={() => handleSave(s)}
                          aria-label="Save session costs"
                        >
                          {savingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      ))}

      <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3 text-sm">
        <span className="text-muted-foreground">Grand total (all sessions):</span>
        <span className="font-bold text-foreground">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}
