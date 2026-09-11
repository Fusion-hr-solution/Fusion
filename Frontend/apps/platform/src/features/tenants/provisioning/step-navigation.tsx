"use client";

import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton } from "@repo/ds/shell";
import { failureKind, failureMessage } from "../api";

/**
 * The controls that move through provisioning, shared by every step so the
 * commitment always sits in the same place. Back is quiet; the forward action
 * carries the weight and becomes the commit on the final step. Any refusal of
 * that commit is shown here, beside the action it concerns.
 */
export function StepNavigation({
  isFirst,
  isLast,
  onBack,
  onPrimary,
  primaryDisabled,
  primaryPending,
  failure,
}: {
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onPrimary: () => void;
  primaryDisabled: boolean;
  primaryPending: boolean;
  failure: Error | null;
}) {
  return (
    <div className="mt-6">
      {failure ? <SubmissionFailure error={failure} /> : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isFirst || primaryPending}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back
        </Button>

        <AsyncButton
          type="button"
          size="lg"
          onClick={onPrimary}
          disabled={primaryDisabled}
          pending={primaryPending}
        >
          {isLast ? "Provision tenant" : "Continue"}
          {!isLast ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
        </AsyncButton>
      </div>
    </div>
  );
}

/**
 * What a refused submission actually tells the operator.
 *
 * The distinction that matters is whether the outcome is known. Provisioning
 * commits the tenant before the response returns, so a timeout or gateway
 * failure can arrive after the tenant exists — claiming "no tenant was created"
 * there is a guarantee this page cannot make. Validation and permission
 * failures are refused before anything is committed, so they can safely say so;
 * the ambiguous ones ask for an unchanged retry, which reuses the idempotency
 * key and cannot create a second tenant.
 */
export function SubmissionFailure({ error }: { error: Error }) {
  const kind = failureKind(error);
  const message =
    kind === "permission"
      ? "Your Platform administration access has changed. Sign in again to provision a tenant."
      : kind === "validation"
        ? (failureMessage(error) ??
          "The request was rejected before anything was created. Your entries are kept.")
        : kind === "conflict"
          ? (failureMessage(error) ??
            "This request conflicts with one already recorded.")
          : kind === "unavailable"
            ? "Provisioning did not complete and the outcome is unknown. Submit again without changing anything — the retry is safe and will not create a second tenant. If it keeps failing, check the tenant list before entering different details."
            : (failureMessage(error) ??
              "Provisioning did not complete and the outcome is unknown. Submit again without changing anything — the retry is safe and will not create a second tenant.");

  return (
    <p
      role="alert"
      className="mb-4 flex items-start gap-2 text-sm text-destructive"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
