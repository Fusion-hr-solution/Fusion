"use client";

import { MonitorPlay, Timer, Lock, Award, Info, Mail, Link2, ArrowLeft, ArrowRight, Settings2 } from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { TEAM_MEMBERS } from "@/config/constants";
import { cn } from "@/lib/utils";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:ring-offset-2",
        checked ? "bg-zinc-900" : "bg-zinc-200"
      )}
    >
      <span className={cn(
        "absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

function SwitchRow({ label, helper, checked, onChange, children }: {
  label: string; helper?: string; checked: boolean;
  onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-zinc-900">{label}</p>
          {helper && <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">{helper}</p>}
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}

function Card({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
          <Icon className="h-4 w-4 text-zinc-600" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-zinc-900">{title}</p>
          {description && <p className="text-[12px] text-zinc-500">{description}</p>}
        </div>
      </div>
      <div className="divide-y divide-zinc-100 px-6">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
      {children}
    </p>
  );
}

function NumberInput({ value, onChange, min, max, suffix }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          const nextValue = raw === "" ? (min ?? 0) : Number(raw);
          onChange(nextValue);
        }}
        className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-medium text-zinc-900 text-right focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
      />
      {suffix && <span className="text-[13px] text-zinc-500">{suffix}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepConfig() {
  const { config, updateConfig, nextStep, prevStep } = useWizardStore();

  return (
    // w-full — fills entire available column, no max-w centering
    <div className="w-full">

      {/* ── Section header ── */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
            <Settings2 className="h-3.5 w-3.5 text-white" />
          </div>
          <h2 className="text-[22px] font-bold tracking-tight text-zinc-900">Test Configuration</h2>
        </div>
        <p className="ml-9 text-[13px] text-zinc-500">
          Customize how candidates experience and complete this test
        </p>
      </div>

      {/* ── Two-column grid: left = experience + time, right = access + scoring ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* ── Left column ── */}
        <div className="flex flex-col gap-5">

          {/* Card 1 — Candidate Experience */}
          <Card icon={MonitorPlay} title="Candidate Experience" description="Control what candidates see and do">
            <SwitchRow
              label="Allow question skipping"
              helper="Candidates can navigate back to unanswered questions"
              checked={config.allowSkipping}
              onChange={(v) => updateConfig({ allowSkipping: v })}
            />
            <SwitchRow
              label="Show progress bar"
              helper="Displays a step indicator during the test"
              checked={config.showProgressBar}
              onChange={(v) => updateConfig({ showProgressBar: v })}
            />
            <SwitchRow
              label="Restrict copy/paste"
              helper="Disables clipboard on coding questions"
              checked={config.restrictCopyPaste}
              onChange={(v) => updateConfig({ restrictCopyPaste: v })}
            />
            <SwitchRow
              label="Enable proctoring"
              helper="Requires webcam — needs integration"
              checked={config.enableProctoring}
              onChange={(v) => updateConfig({ enableProctoring: v })}
            >
              {config.enableProctoring && (
                <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-[12px] leading-relaxed text-amber-700">
                    Proctoring requires a third-party integration. Configure it in workspace Settings before enabling.
                  </p>
                </div>
              )}
            </SwitchRow>
          </Card>

          {/* Card 2 — Time & Attempts */}
          <Card icon={Timer} title="Time & Attempts" description="Time limits and attempt restrictions">
            <SwitchRow
              label="Enable time limit"
              checked={config.enableTimeLimit}
              onChange={(v) => updateConfig({ enableTimeLimit: v })}
            >
              {config.enableTimeLimit && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3.5 py-3">
                  <NumberInput
                    value={config.timeLimitMinutes}
                    onChange={(v) => updateConfig({ timeLimitMinutes: v })}
                    min={1}
                    suffix="minutes"
                  />
                  <span className="text-[11px] text-zinc-400">Recommended: 60–90 min</span>
                </div>
              )}
            </SwitchRow>

            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">Maximum attempts</p>
                <p className="mt-0.5 text-[12px] text-zinc-400">0 = unlimited</p>
              </div>
              <NumberInput
                value={config.maxAttempts}
                onChange={(v) => updateConfig({ maxAttempts: v })}
                min={0}
              />
            </div>

            <SwitchRow
              label="Randomize question order"
              helper="Each candidate sees questions in a different order"
              checked={config.randomizeOrder}
              onChange={(v) => updateConfig({ randomizeOrder: v })}
            />
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5">

          {/* Card 3 — Access Control */}
          <Card icon={Lock} title="Access Control" description="Who can access and when">
            <div className="flex flex-col gap-5 py-4">

              {/* Access type */}
              <div>
                <FieldLabel>Access Type</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "invitation" as const, icon: Mail,  title: "Invitation Only", desc: "Send personalized links to specific candidates" },
                    { value: "open"       as const, icon: Link2, title: "Open Link",        desc: "Anyone with the link can access" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateConfig({ accessType: opt.value })}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-150",
                        config.accessType === opt.value
                          ? "border-zinc-900 bg-zinc-50 shadow-sm"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        config.accessType === opt.value ? "bg-zinc-900" : "bg-zinc-100"
                      )}>
                        <opt.icon className={cn("h-4 w-4", config.accessType === opt.value ? "text-white" : "text-zinc-500")} />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-zinc-900">{opt.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability window */}
              <div>
                <FieldLabel>Availability Window</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Start Date", key: "startDate" as const, value: config.startDate },
                    { label: "End Date",   key: "endDate"   as const, value: config.endDate   },
                  ].map((f) => (
                    <div key={f.key}>
                      <p className="mb-1.5 text-[11px] font-medium text-zinc-500">{f.label}</p>
                      <input
                        type="date"
                        value={f.value}
                        onChange={(e) => updateConfig({ [f.key]: e.target.value })}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Link expiry */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-zinc-900">Link expiry</p>
                  <p className="mt-0.5 text-[12px] text-zinc-400">Days until the link stops working</p>
                </div>
                <NumberInput
                  value={config.linkExpiry}
                  onChange={(v) => updateConfig({ linkExpiry: v })}
                  min={1}
                  suffix="days"
                />
              </div>
            </div>
          </Card>

          {/* Card 4 — Scoring */}
          <Card icon={Award} title="Scoring" description="Pass thresholds and grading behaviour">

            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">Passing threshold</p>
                <p className="mt-0.5 text-[12px] text-zinc-400">Candidates below this score are marked as failed</p>
              </div>
              <NumberInput
                value={config.passingThreshold}
                onChange={(v) => updateConfig({ passingThreshold: v })}
                min={0}
                max={100}
                suffix="%"
              />
            </div>

            <SwitchRow
              label="Allow partial credit"
              helper="Applicable to multi-part and coding questions"
              checked={config.allowPartialCredit}
              onChange={(v) => updateConfig({ allowPartialCredit: v })}
            />

            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-[13px] font-semibold text-zinc-900">Assign reviewer</p>
                <p className="mt-0.5 text-[12px] text-zinc-400">Notified when manual questions need grading</p>
              </div>
              <div className="relative">
                <select
                  value={config.assignedReviewer}
                  onChange={(e) => updateConfig({ assignedReviewer: e.target.value })}
                  className="appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-8 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 transition-all duration-150"
                >
                  <option value="">Unassigned</option>
                  {TEAM_MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

          </Card>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
        <button
          onClick={prevStep}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 shadow-sm transition-all duration-150 hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={nextStep}
          className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-800 active:scale-[0.98]"
        >
          Continue to Review <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}