"use client";

import { useMemo, useState } from "react";
import {
  Field,
  FieldError,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  cn,
} from "@repo/ds";
import { Check, Eye, EyeOff, Lock, X } from "lucide-react";
import {
  passwordChecks,
  type PasswordRequirements,
} from "../../lib/activation";

/**
 * Create-password field with live requirement feedback, after reui's c-input-23:
 * an advisory strength meter over the required requirement checklist.
 *
 * The distinction is deliberate. The checklist is the policy the service will
 * actually enforce — those rows gate the submit. The meter is advisory only: it
 * rewards optional strength (an uppercase letter, a symbol, extra length) so a
 * password can read "Medium" while already being valid. The meter never blocks.
 */
export function PasswordStrengthField({
  id,
  label,
  value,
  onChange,
  requirements,
  error,
  autoComplete = "new-password",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  requirements: PasswordRequirements | null;
  error?: string;
  autoComplete?: string;
}) {
  const [reveal, setReveal] = useState(false);

  // The required rules — the authority for whether the password is acceptable.
  const checks = passwordChecks(value, requirements);

  // Advisory strength, scored over required rules plus optional complexity.
  const score = useMemo(() => strengthScore(value), [value]);
  const meterColor = strengthColor(score, value.length > 0);

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>

      <InputGroup className="h-11">
        <InputGroupAddon>
          <Lock />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type={reveal ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-requirements`}
          onChange={(event) => onChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-sm"
            onClick={() => setReveal((shown) => !shown)}
            aria-label={reveal ? "Hide characters" : "Show characters"}
          >
            {reveal ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Segmented strength meter — advisory, five steps. */}
      <div
        className="mt-1 flex gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={score}
        aria-label="Password strength"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-500",
              i < score ? meterColor : "bg-border"
            )}
          />
        ))}
      </div>

      {checks.length > 0 ? (
        <ul
          id={`${id}-requirements`}
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5"
        >
          {checks.map((check) => (
            <li key={check.label} className="flex items-center gap-1.5 text-xs">
              {check.satisfied ? (
                <Check aria-hidden="true" className="size-3.5 text-success" />
              ) : (
                <X
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground/60"
                />
              )}
              <span
                className={cn(
                  "transition-colors",
                  check.satisfied ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {check.label}
                <span className="sr-only">
                  {check.satisfied ? " — met" : " — not yet met"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/** 0–5, counting required rules plus optional complexity (upper, symbol). */
function strengthScore(password: string): number {
  if (!password) return 0;
  const signals = [
    password.length >= 10,
    /[a-zA-Z]/.test(password),
    /[0-9]/.test(password),
    /[A-Z]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  return signals.filter(Boolean).length;
}

/** Bar colour by score; the meter carries strength on its own, without a label. */
function strengthColor(score: number, hasInput: boolean): string {
  if (!hasInput) return "bg-border";
  if (score <= 2) return "bg-destructive";
  if (score <= 4) return "bg-primary";
  return "bg-success";
}
