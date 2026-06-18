"use client";

import { useMemo, useState } from "react";
import { Building2, Trash2, UserPlus, Users } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import type {
  PopulationRuleInput,
  PopulationRuleType,
  WorkforceOrgUnitTreeNodeDto,
} from "@repo/api";
import { useEmployeeSearch, useOrgUnitTree } from "@/hooks/use-workforce-browse";

interface RuleRow extends PopulationRuleInput {
  label: string;
}

function flattenTree(nodes: WorkforceOrgUnitTreeNodeDto[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.name}` },
    ...flattenTree(node.children, depth + 1),
  ]);
}

export interface PopulationEditorProps {
  initialRules: RuleRow[];
  includeInactive: boolean;
  saving?: boolean;
  errorMessage?: string | null;
  onSave: (includeInactive: boolean, rules: PopulationRuleInput[]) => void;
}

export function PopulationEditor({
  initialRules,
  includeInactive: initialIncludeInactive,
  saving,
  errorMessage,
  onSave,
}: PopulationEditorProps) {
  const [rules, setRules] = useState<RuleRow[]>(initialRules);
  const [includeInactive, setIncludeInactive] = useState(initialIncludeInactive);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>("");
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const { data: tree } = useOrgUnitTree();
  const orgOptions = useMemo(() => flattenTree(tree?.roots ?? []), [tree]);
  const { data: employeeResults } = useEmployeeSearch(employeeSearch, employeeSearch.trim().length > 1);

  const addRule = (rule: RuleRow) => {
    setRules((prev) => {
      const exists = prev.some(
        (r) => r.ruleType === rule.ruleType && r.refId === rule.refId
      );
      return exists ? prev : [...prev, rule];
    });
  };

  const removeRule = (ruleType: PopulationRuleType, refId: string) => {
    setRules((prev) => prev.filter((r) => !(r.ruleType === ruleType && r.refId === refId)));
  };

  const addOrgUnit = () => {
    const option = orgOptions.find((o) => o.id === selectedOrgUnit);
    if (!option) return;
    addRule({
      ruleType: "OrgUnit",
      refId: option.id,
      includeDescendants,
      label: option.label.replace(/—\s/g, ""),
    });
    setSelectedOrgUnit("");
  };

  const handleSave = () => {
    onSave(
      includeInactive,
      rules.map(({ ruleType, refId, includeDescendants: incl }) => ({
        ruleType,
        refId,
        includeDescendants: incl,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Checkbox
          id="include-inactive"
          checked={includeInactive}
          onCheckedChange={(v) => setIncludeInactive(v === true)}
        />
        <Label htmlFor="include-inactive">Include inactive employees</Label>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4" /> Add org unit
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1 space-y-1">
            <Label>Org unit</Label>
            <Select value={selectedOrgUnit} onValueChange={setSelectedOrgUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Select an org unit" />
              </SelectTrigger>
              <SelectContent>
                {orgOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="include-descendants"
              checked={includeDescendants}
              onCheckedChange={(v) => setIncludeDescendants(v === true)}
            />
            <Label htmlFor="include-descendants">Include sub-units</Label>
          </div>
          <Button variant="outline" onClick={addOrgUnit} disabled={!selectedOrgUnit}>
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" /> Add or exclude individuals
        </div>
        <Input
          placeholder="Search employees…"
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
        />
        {employeeResults && employeeResults.items.length > 0 ? (
          <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
            {employeeResults.items.map((emp) => (
              <li key={emp.employeeId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {emp.displayName}
                  <span className="ml-2 text-muted-foreground">{emp.workEmail}</span>
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addRule({
                        ruleType: "IncludeEmployee",
                        refId: emp.employeeId,
                        includeDescendants: false,
                        label: emp.displayName,
                      })
                    }
                  >
                    <UserPlus className="mr-1 h-3 w-3" /> Include
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      addRule({
                        ruleType: "ExcludeEmployee",
                        refId: emp.employeeId,
                        includeDescendants: false,
                        label: emp.displayName,
                      })
                    }
                  >
                    Exclude
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Selected rules ({rules.length})</Label>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rules yet. Add at least one org unit or individual.
          </p>
        ) : (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li
                key={`${rule.ruleType}:${rule.refId}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge variant={rule.ruleType === "ExcludeEmployee" ? "outline" : "secondary"}>
                    {rule.ruleType === "OrgUnit"
                      ? rule.includeDescendants
                        ? "Org unit + sub-units"
                        : "Org unit"
                      : rule.ruleType === "IncludeEmployee"
                        ? "Include"
                        : "Exclude"}
                  </Badge>
                  {rule.label}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeRule(rule.ruleType, rule.refId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save population"}
      </Button>
    </div>
  );
}
