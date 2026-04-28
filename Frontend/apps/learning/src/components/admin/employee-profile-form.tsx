"use client";

import { useState, useCallback } from "react";
import { Loader2, Save, X } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Label,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getGrades,
  getServiceLines,
  upsertEmployeeProfile,
} from "@/services/admin-service";
import type { AdminEmployeeProfile, AdminGrade, AdminServiceLine, UpsertEmployeeProfileInput } from "@/types/admin";

interface EmployeeProfileFormProps {
  profile: AdminEmployeeProfile;
  onSaved: () => void;
  onCancel: () => void;
}

export function EmployeeProfileForm({ profile, onSaved, onCancel }: EmployeeProfileFormProps) {
  const [gradeId, setGradeId] = useState(profile.gradeId ?? "");
  const [serviceLineId, setServiceLineId] = useState(profile.serviceLineId ?? "");

  const fetchGrades = useCallback(() => getGrades(), []);
  const fetchServiceLines = useCallback(() => getServiceLines(), []);
  const { data: grades } = useApiQuery<AdminGrade[]>(fetchGrades, { enabled: true });
  const { data: serviceLines } = useApiQuery<AdminServiceLine[]>(fetchServiceLines, { enabled: true });

  const { mutateAsync: doUpsert, isLoading: saving } = useApiMutation(
    (input: UpsertEmployeeProfileInput) => upsertEmployeeProfile(profile.employeeId, input),
    { onSuccess: onSaved },
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doUpsert({
      gradeId: gradeId || null,
      serviceLineId: serviceLineId || null,
    });
  }

  return (
    <Card className="border-[hsl(var(--ey-blue-400))]/30 border-2">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Employee: <span className="font-medium text-foreground">{profile.employeeId}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ep-grade" className="text-xs">Grade</Label>
              <select
                id="ep-grade"
                value={gradeId}
                onChange={(e) => setGradeId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— No grade —</option>
                {grades?.slice().sort((a, b) => a.level - b.level).map((g) => (
                  <option key={g.id} value={g.id}>{g.name} (Level {g.level})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-sl" className="text-xs">Service Line</Label>
              <select
                id="ep-sl"
                value={serviceLineId}
                onChange={(e) => setServiceLineId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— No service line —</option>
                {serviceLines?.map((sl) => (
                  <option key={sl.id} value={sl.id}>{sl.name} ({sl.code})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving} className="ey-bg-dark hover:opacity-90">
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
