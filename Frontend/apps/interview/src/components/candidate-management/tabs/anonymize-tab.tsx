import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldOff, Trash2, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { AnonymizeTabProps } from "@/services/models/anonymize_tab_model";

const ACTION_CONFIG = {
  anonymize: {
    label: "Anonymize",
    icon: ShieldOff,
    iconWrap: "bg-indigo-100",
    iconColor: "text-indigo-600",
    selectedRing: "ring-2 ring-indigo-500 border-indigo-300",
    selectedBg: "bg-indigo-50/50",
    description: "Pseudonymize name and email. Scores and answers are preserved.",
    buttonBg: "bg-indigo-600 hover:bg-indigo-700",
  },
  "delete-pii": {
    label: "Delete PII",
    icon: Trash2,
    iconWrap: "bg-red-100",
    iconColor: "text-red-600",
    selectedRing: "ring-2 ring-red-500 border-red-300",
    selectedBg: "bg-red-50/50",
    description: "Permanently erase all PII. Answers and scores are retained.",
    buttonBg: "bg-red-600 hover:bg-red-700",
  },
} as const;

type ActionKey = keyof typeof ACTION_CONFIG;

export function AnonymizeTab({
  selectedTestId,
  setSelectedTestId,
  tests,
  timelineCandidates,
  selectedCandidateEmail,
  setSelectedCandidateEmail,
  adminId,
  setAdminId,
  action,
  setAction,
  submitting,
  error,
  success,
  onConfirm,
}: AnonymizeTabProps) {
  const [confirmed, setConfirmed] = useState(false);
  const hasTests = tests.length > 0;
  const hasCandidates = timelineCandidates.length > 0;

  const candidateOptions = useMemo(
    () =>
      timelineCandidates.map((candidate) => ({
        value: candidate.candidateEmail,
        label: candidate.candidateName
          ? `${candidate.candidateName} (${candidate.candidateEmail})`
          : candidate.candidateEmail,
      })),
    [timelineCandidates]
  );

  useEffect(() => {
    setConfirmed(false);
  }, [selectedTestId, selectedCandidateEmail, action, adminId]);

  const isReady =
    !!selectedTestId &&
    !!selectedCandidateEmail &&
    adminId.trim().length > 0 &&
    confirmed &&
    !submitting;

  const cfg = ACTION_CONFIG[action as ActionKey] ?? ACTION_CONFIG.anonymize;
  const Icon = cfg.icon;

  return (
    <div className="mt-5 space-y-5">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <UserX className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Anonymize / Delete Candidate PII</p>
            <p className="text-[12px] text-zinc-500">
              Apply a privacy action to a specific candidate. Test results are always preserved.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Test + candidate selectors */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DropdownSelect
              id="privacy-test"
              label="Test"
              placeholder={hasTests ? "Select test" : "No tests available"}
              value={selectedTestId}
              options={tests.map((test) => ({ value: test.id, label: test.title }))}
              onChange={setSelectedTestId}
              disabled={!hasTests}
            />
            <DropdownSelect
              id="privacy-candidate"
              label="Candidate"
              placeholder={hasCandidates ? "Select candidate" : "No candidates available"}
              value={selectedCandidateEmail}
              options={candidateOptions}
              onChange={setSelectedCandidateEmail}
              disabled={!hasCandidates}
            />
          </div>

          {/* Action selection */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Privacy Action
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(ACTION_CONFIG) as ActionKey[]).map((value) => {
                const c = ACTION_CONFIG[value];
                const ActionIcon = c.icon;
                const isActive = action === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAction(value)}
                    className={cn(
                      "group rounded-xl border px-4 py-3.5 text-left transition-all duration-150 focus:outline-none",
                      isActive
                        ? c.selectedRing + " " + c.selectedBg
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        isActive ? c.iconWrap : "bg-zinc-100 group-hover:bg-zinc-200"
                      )}>
                        <ActionIcon className={cn("h-4 w-4 transition-colors", isActive ? c.iconColor : "text-zinc-500")} />
                      </span>
                      {isActive ? (
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", c.iconWrap)}>
                          <CheckCircle2 className={cn("h-3.5 w-3.5", c.iconColor)} />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2.5 text-[13px] font-bold text-zinc-900">{c.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{c.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin ID */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              Admin ID
            </label>
            <input
              type="text"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              placeholder="Recruiter / admin identifier or email"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-900 placeholder:text-zinc-400 transition-all duration-150 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="text-[12px] text-zinc-400">Required for audit logging.</p>
          </div>

          {/* Warning + confirm */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <div>
                <p className="text-[12px] font-semibold text-amber-800">This action is irreversible.</p>
                <p className="mt-0.5 text-[12px] text-amber-700">
                  Candidate PII will be permanently removed or replaced.
                </p>
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12px] font-medium text-amber-900">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              I understand this cannot be undone.
            </label>
          </div>

          {/* Feedback */}
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </div>
          ) : null}

          {/* Submit */}
          <div className="flex items-center justify-end border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onConfirm}
              disabled={!isReady}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-white transition-all duration-150",
                isReady
                  ? cfg.buttonBg + " active:scale-[0.98]"
                  : "cursor-not-allowed bg-zinc-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {submitting ? "Processing..." : `${cfg.label} Candidate`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
