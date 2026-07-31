"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Sparkles, Compass, Clock, AlertTriangle } from "lucide-react";
import { Input } from "@repo/ui";
import { getLearningPath, type LearningPathResult } from "@/services/learning-service";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";
import { TrainingCard } from "./training-card";

const EXAMPLE_KEYS = ["manager", "data", "speaking"] as const;

export function LearningPathView() {
  const t = useTranslations("path");
  const locale = useLocale();

  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<LearningPathResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [searched, setSearched] = useState(false);
  const reqIdRef = useRef(0);

  const runSearch = useCallback(
    async (raw: string) => {
      const g = raw.trim();
      if (!g) return;
      // Supersede any in-flight request (e.g. an Enter re-submit while loading) so a slow
      // earlier response can never overwrite a newer one.
      const reqId = ++reqIdRef.current;
      setGoal(g);
      setSearched(true);
      setStatus("loading");
      setResult(null);
      try {
        // Personalized + authenticated; empty steps = the honest "no path" signal, an
        // error (service down) is distinct → the two render different states below.
        const r = await getLearningPath(g, { locale });
        if (reqIdRef.current !== reqId) return;
        setResult(r);
        setStatus("idle");
      } catch {
        if (reqIdRef.current !== reqId) return;
        setStatus("error");
      }
    },
    [locale],
  );

  const steps = result?.steps ?? [];

  return (
    <>
      <PageHeader
        moduleTitle={t("header.moduleTitle")}
        title={t("header.title")}
        description={t("header.description")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(goal);
          }}
          className="ey-animate-fade-up mt-6 flex max-w-2xl gap-2"
          style={{ animationDelay: "150ms" }}
        >
          <div className="relative flex-1">
            <Sparkles className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ey-text-accent" aria-hidden="true" />
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("input.placeholder")}
              aria-label={t("input.aria")}
              maxLength={200}
              className="h-11 rounded-lg border-border/60 bg-muted/50 pl-10 text-sm shadow-sm placeholder:text-muted-foreground/60 focus-visible:ring-[hsl(var(--ey-yellow))] focus-visible:border-[hsl(var(--ey-yellow)/0.4)]"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading" || !goal.trim()}
            className="shrink-0 rounded-lg ey-bg-dark px-5 text-sm font-semibold text-white transition-all hover:ey-bg-dark-deep hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading" ? t("input.building") : t("input.submit")}
          </button>
        </form>

        <div
          className="ey-animate-fade-up mt-3 flex flex-wrap items-center gap-2"
          style={{ animationDelay: "220ms" }}
        >
          <span className="text-xs text-muted-foreground">{t("examples.label")}</span>
          {EXAMPLE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => runSearch(t(`examples.${k}`))}
              disabled={status === "loading"}
              className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-50"
            >
              {t(`examples.${k}`)}
            </button>
          ))}
        </div>
      </PageHeader>

      <section className="px-8 py-8">
        {status === "loading" && (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 ey-text-accent motion-safe:animate-pulse" aria-hidden="true" />
            {t("loading")}
          </div>
        )}

        {status === "error" && (
          <EmptyState
            icon={AlertTriangle}
            title={t("error.title")}
            subtitle={t("error.description")}
            action={
              <button
                onClick={() => runSearch(goal)}
                className="mt-4 rounded-lg ey-bg-dark px-4 py-2 text-xs font-semibold text-white transition-all hover:ey-bg-dark-deep hover:shadow-md"
              >
                {t("error.retry")}
              </button>
            }
          />
        )}

        {status === "idle" && !searched && (
          <EmptyState icon={Compass} title={t("hint.title")} subtitle={t("hint.description")} />
        )}

        {status === "idle" && searched && steps.length === 0 && (
          <EmptyState icon={Compass} title={t("empty.title")} subtitle={t("empty.description")} />
        )}

        {status === "idle" && steps.length > 0 && (
          <div className="ey-animate-fade-up">
            {result?.intro && (
              <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-4 py-3" role="status">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 ey-text-accent" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-foreground">{result.intro}</p>
              </div>
            )}

            <div className="mb-5 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t("result.count", { count: steps.length })}
              </span>
              {result?.effortTotal != null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("result.effort", { hours: result.effortTotal })}
                </span>
              )}
            </div>

            <ol className="space-y-5 ey-stagger-list">
              {steps.map((step) => (
                <li key={step.id} className="flex gap-4">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ey-bg-dark text-sm font-semibold text-white"
                    aria-hidden="true"
                  >
                    {step.order}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 ey-text-accent" aria-hidden="true" />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <span className="sr-only">{t("result.whyLabel")}: </span>
                        {step.rationale}
                      </p>
                    </div>
                    <TrainingCard training={step} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </>
  );
}
