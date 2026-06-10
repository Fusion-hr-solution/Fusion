import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { AnonymizeTabProps } from "@/services/models/anonymize_tab_model";

const ACTION_LABELS = {
  anonymize: "Anonymize",
  "delete-pii": "Delete PII",
} as const;

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

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <UserX className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Anonymize or delete candidate PII</p>
            <p className="mt-1 text-[12px] text-zinc-500">
              Replaces name and email with pseudonyms, clears security identifiers, and retains test
              answers and results.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[240px,1fr]">
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

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Action</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(ACTION_LABELS) as Array<keyof typeof ACTION_LABELS>).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAction(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12px] font-semibold",
                    action === value
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                  )}
                >
                  {ACTION_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-zinc-500">
              {action === "anonymize"
                ? "Pseudonymize candidate data and keep results."
                : "Delete PII while preserving answers and scores."}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Admin ID</p>
            <input
              type="text"
              value={adminId}
              onChange={(event) => setAdminId(event.target.value)}
              placeholder="Enter recruiter/admin identifier"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="mt-2 text-[12px] text-zinc-500">
              Required for audit logging. Use a user ID or email.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
            <div>
              <p className="text-[12px] font-semibold text-amber-700">This action is irreversible.</p>
              <p className="text-[12px] text-amber-700">
                Candidate PII will be permanently removed or replaced.
              </p>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-amber-800">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            I understand this cannot be undone.
          </label>
        </div>

        {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}
        {success ? (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isReady}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-[12px] font-semibold text-white",
              !isReady ? "opacity-50" : "hover:bg-red-700"
            )}
          >
            {submitting ? "Processing..." : `${ACTION_LABELS[action]} candidate`}
          </button>
        </div>
      </section>
    </div>
  );
}
