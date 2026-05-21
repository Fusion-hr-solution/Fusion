import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  RefreshCw,
  Settings2,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttemptLimitsTabProps } from "@/services/models/attempt_limits_tab_model";

function formatOverride(value?: number | null): {
  label: string;
  isCustom: boolean;
} {
  if (value == null) return { label: "Global default", isCustom: false };
  if (value === 0) return { label: "Unlimited", isCustom: true };
  return { label: `${value} attempt${value === 1 ? "" : "s"}`, isCustom: true };
}

function formatEffective(override: number | null | undefined, global: number): string {
  const val = override ?? global;
  if (val <= 0) return "Unlimited";
  return `${val} attempt${val === 1 ? "" : "s"}`;
}

export function AttemptLimitsTab({
  selectedTestId,
  setSelectedTestId,
  tests,
  globalMaxAttempts,
  setGlobalMaxAttempts,
  attemptSettingsLoading,
  attemptSettingsSaving,
  attemptSettingsError,
  attemptSettingsSuccess,
  onSaveAttemptSettings,
}: AttemptLimitsTabProps) {
  const selectedTest = tests.find((t) => t.id === selectedTestId);
  const customOverrideCount = tests.filter((t) => t.maxAttempts != null).length;

  return (
    <div className="mt-5 space-y-5">
      {/* ── Global policy ──────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
            <Settings2 className="h-4 w-4 text-zinc-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Global Attempt Policy</p>
            <p className="text-[12px] text-zinc-500">
              Fallback for any test without a custom override. Use 0 for unlimited.
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="global-max-attempts"
                className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400"
              >
                Default Max Attempts
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="global-max-attempts"
                  type="number"
                  min={0}
                  value={globalMaxAttempts}
                  onChange={(e) =>
                    setGlobalMaxAttempts(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-right text-[14px] font-bold text-zinc-900 transition-all duration-150 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <span className="text-[13px] font-medium text-zinc-500">
                  {globalMaxAttempts === 0
                    ? "= Unlimited"
                    : `attempt${globalMaxAttempts === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSaveAttemptSettings}
              disabled={attemptSettingsSaving || attemptSettingsLoading}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-white transition-all duration-150",
                attemptSettingsSaving || attemptSettingsLoading
                  ? "cursor-not-allowed bg-zinc-300"
                  : "bg-zinc-900 hover:bg-zinc-700 active:scale-[0.98]"
              )}
            >
              {attemptSettingsSaving ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Settings2 className="h-3.5 w-3.5" />
                  Save Policy
                </>
              )}
            </button>
          </div>

          {attemptSettingsLoading ? (
            <div className="mt-4 flex items-center gap-2 text-[12px] text-zinc-400">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Loading attempt settings...
            </div>
          ) : null}
          {attemptSettingsError ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {attemptSettingsError}
            </div>
          ) : null}
          {attemptSettingsSuccess ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {attemptSettingsSuccess}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Per-test overrides ─────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
            <Target className="h-4 w-4 text-zinc-600" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-zinc-900">Per-Test Overrides</p>
            <p className="text-[12px] text-zinc-500">
              Click a test to inspect its policy. Overrides are set in Test Configuration.
            </p>
          </div>
          {customOverrideCount > 0 ? (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-600">
              {customOverrideCount} custom
            </span>
          ) : null}
        </div>

        {/* Scrollable test list */}
        {tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100">
              <Target className="h-4 w-4 text-zinc-400" />
            </div>
            <p className="mt-3 text-[13px] font-semibold text-zinc-700">No tests yet</p>
            <p className="mt-1 text-center text-[12px] text-zinc-400">
              Tests will appear here once created.
            </p>
          </div>
        ) : (
          <>
            {/* Column labels */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-zinc-100 bg-zinc-50/70 px-5 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Test</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Override</p>
              <p className="w-28 text-right text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Effective
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto scrollbar-hide divide-y divide-zinc-50">
              {tests.map((test) => {
                const { label: overrideLabel, isCustom } = formatOverride(test.maxAttempts);
                const effective = formatEffective(test.maxAttempts, globalMaxAttempts);
                const isSelected = test.id === selectedTestId;

                return (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => setSelectedTestId(test.id)}
                    className={cn(
                      "group grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 text-left transition-all duration-100",
                      isSelected
                        ? "border-l-2 border-l-zinc-900 bg-zinc-50"
                        : "border-l-2 border-l-transparent hover:bg-zinc-50/70"
                    )}
                  >
                    {/* Test info */}
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-[13px] font-semibold",
                          isSelected ? "text-zinc-900" : "text-zinc-700"
                        )}
                      >
                        {test.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-zinc-200 bg-white px-1.5 py-px font-medium">
                          {test.discipline}
                        </span>
                        <span className="flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" />
                          {test.questionCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {test.candidateCount}
                        </span>
                      </div>
                    </div>

                    {/* Override badge */}
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        isCustom
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-zinc-100 text-zinc-400"
                      )}
                    >
                      {overrideLabel}
                    </span>

                    {/* Effective */}
                    <span
                      className={cn(
                        "w-28 shrink-0 text-right text-[12px] font-bold tabular-nums",
                        isSelected ? "text-zinc-900" : "text-zinc-600"
                      )}
                    >
                      {effective}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected test detail strip */}
            {selectedTest ? (
              <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                      Selected — {selectedTest.title}
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold text-zinc-900">
                      {selectedTest.maxAttempts != null
                        ? `Custom override: ${formatOverride(selectedTest.maxAttempts).label}`
                        : "No override — using global default"}
                    </p>
                  </div>
                  <span className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-bold text-zinc-900 shadow-sm">
                    Effective: {formatEffective(selectedTest.maxAttempts, globalMaxAttempts)}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Read-only notice */}
        <div className="border-t border-zinc-100 bg-white px-5 py-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            <p className="text-[12px] leading-relaxed text-blue-700">
              Overrides are set in the Test Configuration step. This list is read-only.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
