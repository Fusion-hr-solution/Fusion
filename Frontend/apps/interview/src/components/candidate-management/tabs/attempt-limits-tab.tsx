import { Info, Settings2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { AttemptLimitsTabProps } from "@/services/models/attempt_limits_tab_model";

function formatAttempts(value?: number | null): string {
  if (value === 0) {
    return "Unlimited";
  }
  if (value == null) {
    return "Uses global default";
  }
  return `${value} attempt${value === 1 ? "" : "s"}`;
}

function formatEffectiveAttempts(value: number): string {
  if (value <= 0) {
    return "Unlimited";
  }
  return `${value} attempt${value === 1 ? "" : "s"}`;
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
  const selectedTest = tests.find((test) => test.id === selectedTestId);
  const selectedOverride = selectedTest?.maxAttempts ?? null;
  const effectiveAttempts = selectedOverride ?? globalMaxAttempts;
  const hasTests = tests.length > 0;

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Global attempt policy</p>
            <p className="mt-1 text-[12px] text-zinc-500">
              Sets the default max attempts for tests without overrides. Use 0 for unlimited.
            </p>
          </div>
          <button
            type="button"
            onClick={onSaveAttemptSettings}
            disabled={attemptSettingsSaving}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors",
              attemptSettingsSaving ? "opacity-60" : "hover:bg-zinc-800"
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {attemptSettingsSaving ? "Saving..." : "Save policy"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="global-max-attempts" className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Default max attempts
          </label>
          <input
            id="global-max-attempts"
            type="number"
            min={0}
            value={globalMaxAttempts}
            onChange={(e) => setGlobalMaxAttempts(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-[13px] font-medium text-zinc-900 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <span className="text-[12px] text-zinc-500">attempts</span>
        </div>

        {attemptSettingsLoading ? (
          <p className="mt-3 text-[12px] text-zinc-500">Loading attempt settings...</p>
        ) : null}
        {attemptSettingsError ? (
          <p className="mt-3 text-[12px] text-red-600">{attemptSettingsError}</p>
        ) : null}
        {attemptSettingsSuccess ? (
          <p className="mt-3 text-[12px] text-emerald-700">{attemptSettingsSuccess}</p>
        ) : null}
      </section>

      <section className="overflow-visible rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
            <Target className="h-4 w-4 text-zinc-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Per-test overrides</p>
            <p className="text-[12px] text-zinc-500">Review how each test customizes the global policy.</p>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px,1fr] md:items-end">
            <DropdownSelect
              id="attempt-limits-test"
              label="Test"
              placeholder={hasTests ? "Select test" : "No tests available"}
              value={selectedTestId}
              options={tests.map((test) => ({ value: test.id, label: test.title }))}
              onChange={setSelectedTestId}
              disabled={!hasTests}
            />
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Override status</p>
              <p className="mt-1 text-[13px] font-semibold text-zinc-900">
                {selectedTest ? formatAttempts(selectedOverride) : "Select a test to view overrides"}
              </p>
              {selectedTest ? (
                <p className="mt-1 text-[12px] text-zinc-500">
                  Effective policy: {formatEffectiveAttempts(effectiveAttempts)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-[12px] leading-relaxed text-amber-700">
              Per-test overrides are edited in the Test Configuration step. This panel is read-only.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
