"use client";

import Link from "next/link";
import { FileWarning, Lock } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer } from "@repo/ds/shell";

/**
 * The composer refuses to open when its route context cannot produce a valid objective: no parent
 * was supplied, or the parent is still a Draft (only a Published objective is an alignment
 * baseline). Rather than a form that will fail on submit, the author gets a plain reason and a way
 * back to Organization Goals.
 */
export function NotAlignmentBaseline({
  reason,
  title,
}: {
  reason: "missing" | "draft";
  title?: string;
}) {
  return (
    <PageContainer width="narrow">
      <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
        <FileWarning className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">
          {reason === "draft" ? "This direction isn't published yet" : "No parent direction selected"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {reason === "draft"
            ? `Organizational objectives align beneath a published objective.${title ? ` Publish "${title}" first,` : " Publish the parent first,"} then add objectives beneath it.`
            : "Open Organization Goals and add an objective beneath a published direction."}
        </p>
        <Button asChild className="mt-5" variant="outline">
          <Link href="/goals">Back to Organization Goals</Link>
        </Button>
      </div>
    </PageContainer>
  );
}

/** A published (or otherwise non-editable) objective cannot be re-opened in the composer. */
export function NotEditable({ published }: { published: boolean }) {
  return (
    <PageContainer width="narrow">
      <div className="mt-10 rounded-2xl border border-dashed p-10 text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">
          {published ? "This objective is published" : "This objective can't be edited"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {published
            ? "A published objective's definition is fixed. Manage its contribution and progress from Organization Goals."
            : "You don't have edit access to this objective, or it's no longer a draft."}
        </p>
        <Button asChild className="mt-5" variant="outline">
          <Link href="/goals">Back to Organization Goals</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
