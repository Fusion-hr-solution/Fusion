"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Circle,
  Mail,
  Shield,
  Verified,
} from "lucide-react";
import {
  ApiError,
  createApiClient,
  invitePaths,
  type AcceptInviteRequest,
  type InviteDto,
} from "@repo/api";
import { CoreInput, CorePrimaryButton } from "@/components/core-ui";
import { stableSessionLabelFromReactId } from "@/lib/stable-session-label";
import { cn } from "@/lib/utils";

const anonClient = createApiClient({ baseUrl: "/api" });

export function PublicInviteView() {
  const searchParams = useSearchParams();
  const reactId = useId();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDto | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const sessionId = useMemo(
    () => stableSessionLabelFromReactId(reactId),
    [reactId]
  );

  useEffect(() => {
    if (!token) {
      setInviteError("This link is missing a token. Use the link from your invitation email.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const dto = await anonClient.get<InviteDto>(invitePaths.validate(token), {
          skipAuth: true,
        });
        if (!cancelled) {
          setInvite(dto);
          setFirstName(dto.firstName?.trim() ?? "");
          setLastName(dto.lastName?.trim() ?? "");
        }
      } catch {
        if (!cancelled) {
          setInviteError(
            "This invitation is invalid, expired, or already used."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const requirements = useMemo(() => {
    const len = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const digit = /\d/.test(password);
    const special = /[^A-Za-z0-9]/.test(password);
    return { len, upper, lower, digit, special };
  }, [password]);

  const needsName =
    invite &&
    (!invite.firstName?.trim() || !invite.lastName?.trim());

  const canSubmit =
    Boolean(token) &&
    password.length > 0 &&
    password === confirm &&
    requirements.len &&
    requirements.upper &&
    requirements.lower &&
    requirements.digit &&
    requirements.special &&
    (!needsName || (firstName.trim() && lastName.trim()));

  async function onAccept() {
    if (!token || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: AcceptInviteRequest = {
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      };
      await anonClient.post(invitePaths.accept(token), body, {
        skipAuth: true,
      });
      setDone(true);
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? (e.errors[0] ?? e.message)
          : e instanceof Error
            ? e.message
            : "Could not complete registration.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const orgName = invite?.tenantName ?? "your organization";
  const email = invite?.email ?? "";

  const shellOrigin =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SHELL_ORIGIN ?? "http://localhost:3000"
      : "http://localhost:3000";

  // Build URL to sign in with redirect to welcome page (must be before conditionals)
  const welcomeRedirectUrl = useMemo(() => {
    const next = encodeURIComponent("/core/welcome?activation=1");
    return `${shellOrigin}/auth/signin?next=${next}`;
  }, [shellOrigin]);

  if (loading) {
    return (
      <div className="core-ui-root flex min-h-screen items-center justify-center bg-ch-surface font-chBody text-ch-on-surface">
        <p className="text-sm text-ch-secondary">Loading invitation…</p>
      </div>
    );
  }

  if (inviteError || !invite) {
    return (
      <div className="core-ui-root flex min-h-screen flex-col items-center justify-center bg-ch-surface px-6 font-chBody text-ch-on-surface">
        <p className="max-w-md text-center text-sm text-ch-error">{inviteError}</p>
        <p className="mt-6 max-w-md text-center text-xs text-ch-on-surface-variant">
          Please contact your administrator for a new invitation.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="core-ui-root flex min-h-screen flex-col items-center justify-center bg-ch-surface px-6 font-chBody text-ch-on-surface">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ch-tertiary-container">
          <CheckCircle className="h-8 w-8 text-ch-on-tertiary-container" />
        </div>
        <h1 className="mt-6 font-chHeadline text-2xl font-bold text-ch-on-surface">
          Your organization is now active
        </h1>
        <p className="mt-3 max-w-md text-center text-sm text-ch-secondary">
          Your account has been created. Sign in to access your Admin Dashboard
          and start setting up your organization.
        </p>
        <a
          href={welcomeRedirectUrl}
          className="mt-8 inline-flex items-center gap-2 rounded-ch-md bg-[#ffe600] px-6 py-3 text-sm font-bold text-ch-on-surface transition-colors hover:bg-[#e6cf00]"
        >
          Continue to your organization
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="core-ui-root fixed inset-0 z-[80] flex min-h-screen flex-col overflow-y-auto bg-ch-surface font-chBody text-ch-on-surface">
      <header className="z-10 flex w-full items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="flex flex-col leading-none">
            <span className="text-xl font-black tracking-tighter text-ch-on-surface">
              EY
            </span>
            <span className="text-[0.55rem] font-bold uppercase tracking-[0.2em] text-ch-on-surface">
              Building a better working world
            </span>
          </div>
          <div className="mx-4 h-6 w-px bg-ch-surface-container-highest" />
          <span className="font-chHeadline text-base font-bold uppercase tracking-widest text-ch-on-surface-variant">
            Fusion
          </span>
        </div>
      </header>

      <main className="relative flex flex-grow items-center justify-center px-6 py-12">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 overflow-hidden opacity-10">
          <svg
            className="h-full w-full fill-ch-primary-container text-ch-primary-container"
            viewBox="0 0 100 100"
            aria-hidden
          >
            <path d="M0 0 L100 0 L100 100 Z" />
          </svg>
        </div>

        <div className="z-10 w-full max-w-[560px]">
          <div
            className={cn(
              "overflow-hidden rounded-ch-lg shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]",
              "border border-ch-outline-variant/20 bg-white/80 backdrop-blur-md"
            )}
          >
            <div className="border-b border-ch-surface-container-low px-8 py-8">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-ch-md bg-ch-primary-container">
                  <Mail className="h-5 w-5 text-ch-on-primary-container" aria-hidden />
                </div>
                <span className="font-chHeadline text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant">
                  Administrator Invite
                </span>
              </div>
              <h1 className="mb-3 font-chHeadline text-2xl font-extrabold leading-tight tracking-tight text-ch-on-surface">
                You&apos;ve been invited to administer{" "}
                <span className="bg-ch-primary-container px-1.5 py-0.5 text-ch-on-surface">
                  {orgName}
                </span>{" "}
                in Fusion.
              </h1>
              <p className="max-w-md text-[0.8125rem] leading-relaxed text-ch-on-surface-variant">
                Complete password setup to activate your account for this
                organization.
              </p>
            </div>

            <div className="bg-ch-surface-container-lowest px-8 py-8">
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onAccept();
                }}
              >
                {submitError ? (
                  <p className="rounded-ch-md border border-ch-error/40 bg-ch-error-container/20 px-3 py-2 text-sm text-ch-error">
                    {submitError}
                  </p>
                ) : null}
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                    >
                      Work Email
                    </label>
                    <CoreInput
                      id="email"
                      type="email"
                      disabled
                      value={email}
                      readOnly
                    />
                    <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-ch-tertiary">
                      <Shield className="h-3.5 w-3.5" aria-hidden />
                      Invitation sent to this address
                    </p>
                  </div>
                  {needsName ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="fn"
                          className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                        >
                          First name
                        </label>
                        <CoreInput
                          id="fn"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          autoComplete="given-name"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="ln"
                          className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                        >
                          Last name
                        </label>
                        <CoreInput
                          id="ln"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="password"
                        className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                      >
                        Create Password
                      </label>
                      <CoreInput
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="confirm_password"
                        className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                      >
                        Confirm Password
                      </label>
                      <CoreInput
                        id="confirm_password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-ch-md bg-ch-surface-container-low/50 p-4">
                  <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-wider text-ch-on-secondary-fixed-variant">
                    Password (match your organization policy)
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <Req ok={requirements.len} label="8+ characters" />
                    <Req ok={requirements.upper} label="Uppercase" />
                    <Req ok={requirements.lower} label="Lowercase" />
                    <Req ok={requirements.digit} label="Number" />
                    <Req ok={requirements.special} label="Special character" />
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-2">
                  <CorePrimaryButton
                    type="submit"
                    disabled={!canSubmit || submitting}
                    className="group uppercase tracking-wide transition-opacity hover:opacity-90"
                  >
                    {submitting ? "Creating account…" : "Accept invitation & continue"}
                    <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
                  </CorePrimaryButton>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 opacity-40 grayscale">
                <Verified className="h-4 w-4" aria-hidden />
                <span className="text-[0.55rem] font-bold uppercase tracking-widest">
                  Encrypted
                </span>
              </div>
              <div className="flex items-center gap-1.5 opacity-40 grayscale">
                <Shield className="h-4 w-4" aria-hidden />
                <span className="text-[0.55rem] font-bold uppercase tracking-widest">
                  Secure Session
                </span>
              </div>
            </div>
            <div className="text-[0.625rem] font-medium text-ch-on-surface-variant/60">
              Session ID:{" "}
              <span className="font-mono uppercase">{sessionId}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[0.7rem] font-medium text-ch-on-surface-variant">
      {ok ? (
        <CheckCircle className="h-3.5 w-3.5 text-ch-tertiary" aria-hidden />
      ) : (
        <Circle className="h-3.5 w-3.5 text-ch-on-surface-variant/30" aria-hidden />
      )}
      {label}
    </div>
  );
}
