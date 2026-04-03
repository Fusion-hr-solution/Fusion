"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle, Circle, Mail, Shield, Verified } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_ORG = "Acme Corp";
const DEFAULT_EMAIL = "alex.executive@acmecorp.com";

export function PublicInviteView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgName = searchParams.get("org") ?? DEFAULT_ORG;
  const email = searchParams.get("email") ?? DEFAULT_EMAIL;

  const sessionId = useMemo(
    () => `FUS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    []
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const requirements = useMemo(() => {
    const len = password.length >= 12;
    const cases = /[a-z]/.test(password) && /[A-Z]/.test(password);
    const special = /[^A-Za-z0-9]/.test(password);
    return { len, cases, special };
  }, [password]);

  const canSubmit =
    password.length > 0 &&
    password === confirm &&
    requirements.len &&
    requirements.cases &&
    requirements.special;

  function onAccept() {
    if (!canSubmit) return;
    router.push("/corehr/organizations");
  }

  return (
    <div className="fixed inset-0 z-[80] flex min-h-screen flex-col overflow-y-auto bg-ch-surface font-chBody text-ch-on-surface">
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
              "overflow-hidden rounded-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]",
              "border border-ch-outline-variant/20 bg-white/80 backdrop-blur-md"
            )}
          >
            <div className="border-b border-ch-surface-container-low px-8 py-8">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ch-primary-container">
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
                Access the executive console to manage platform operations, review
                system status, and configure organizational parameters.
              </p>
            </div>

            <div className="bg-ch-surface-container-lowest px-8 py-8">
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  onAccept();
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                    >
                      Work Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      disabled
                      value={email}
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border-none bg-ch-surface-container-low px-3.5 py-2.5 text-sm text-ch-on-surface-variant/70"
                    />
                    <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-ch-tertiary">
                      <Shield className="h-3.5 w-3.5" aria-hidden />
                      Verified professional identity
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="password"
                        className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                      >
                        Create Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border-none bg-ch-surface px-3.5 py-2.5 text-sm text-ch-on-surface ring-1 ring-inset ring-ch-outline-variant/30 transition-all focus:ring-2 focus:ring-ch-primary"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="confirm_password"
                        className="mb-2 block text-[0.625rem] font-bold uppercase tracking-widest text-ch-on-surface-variant"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="confirm_password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg border-none bg-ch-surface px-3.5 py-2.5 text-sm text-ch-on-surface ring-1 ring-inset ring-ch-outline-variant/30 transition-all focus:ring-2 focus:ring-ch-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-ch-surface-container-low/50 p-4">
                  <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-wider text-ch-on-secondary-fixed-variant">
                    Security Requirements
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <Req
                      ok={requirements.len}
                      label="12+ characters"
                    />
                    <Req
                      ok={requirements.cases}
                      label="Upper & Lower case"
                    />
                    <Req
                      ok={requirements.special}
                      label="Special character"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="group flex w-full items-center justify-center gap-2 rounded-lg bg-ch-primary-container px-6 py-3.5 font-bold text-ch-on-primary-container transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ACCEPT INVITATION &amp; CONTINUE
                    <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
                  </button>
                  <p className="text-center text-[0.65rem] leading-relaxed text-ch-on-surface-variant">
                    By accepting, you agree to the Executive Console{" "}
                    <a className="font-semibold underline hover:text-ch-on-surface" href="#">
                      Service Terms
                    </a>{" "}
                    and{" "}
                    <a className="font-semibold underline hover:text-ch-on-surface" href="#">
                      Privacy Protocol
                    </a>
                    .
                  </p>
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
