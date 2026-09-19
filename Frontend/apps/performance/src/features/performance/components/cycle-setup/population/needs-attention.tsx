"use client";

import { ExternalLink, TriangleAlert } from "lucide-react";
import type { PopulationCandidateDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { StatusBadge } from "@repo/ds/shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ds/components/ui/table";
import { readinessIssueDetail } from "@/features/performance/lib";
import { primaryIssue } from "./population-model";
import { EmployeeCell, OrgCell, ReviewerCell } from "./population-cells";

export function coreProfileHref(employeeId: string): string {
  return `/core/people/${employeeId}`;
}

/**
 * The blockers, surfaced before the healthy roster. These people can't participate until the Core
 * data is fixed or they're excluded with a reason — so each row leads to Core or to exclusion, and
 * nowhere else. Population never edits HR master data itself.
 */
export function NeedsAttention({
  candidates,
  eligibilityDate,
  onExclude,
}: {
  candidates: PopulationCandidateDto[];
  eligibilityDate: string;
  onExclude: (candidate: PopulationCandidateDto) => void;
}) {
  if (candidates.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.04]">
      <div className="flex items-center justify-between gap-4 border-b border-amber-500/20 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <TriangleAlert className="size-4 text-amber-500" aria-hidden />
          <div>
            <h3 className="type-subsection-title text-foreground">Needs attention</h3>
            <p className="type-meta text-muted-foreground">
              Resolve the issue in Core or exclude the person to continue.
            </p>
          </div>
        </div>
        <StatusBadge tone="warning">
          {candidates.length} {candidates.length === 1 ? "employee" : "employees"}
        </StatusBadge>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Employee</TableHead>
            <TableHead className="hidden md:table-cell">Organization</TableHead>
            <TableHead className="hidden lg:table-cell">Reviewer</TableHead>
            <TableHead>Issue</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => {
            const issue = primaryIssue(candidate);
            return (
              <TableRow key={candidate.employeeId} className="hover:bg-amber-500/[0.03]">
                <TableCell>
                  <EmployeeCell candidate={candidate} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <OrgCell candidate={candidate} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <ReviewerCell candidate={candidate} />
                </TableCell>
                <TableCell>
                  <p className="type-label text-amber-600 dark:text-amber-400">{issue?.label ?? "Not eligible"}</p>
                  {issue ? (
                    <p className="type-meta text-muted-foreground">
                      {readinessIssueDetail(issue.code, eligibilityDate)}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={coreProfileHref(candidate.employeeId)} target="_blank" rel="noopener noreferrer">
                        View in Core
                        <ExternalLink className="size-3.5" data-icon="inline-end" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onExclude(candidate)}>
                      Exclude
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
