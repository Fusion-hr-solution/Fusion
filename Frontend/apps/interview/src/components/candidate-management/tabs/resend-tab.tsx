import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateInvitation, Test } from "@/types";

interface ResendTabProps {
  resendSearch: string;
  setResendSearch: (value: string) => void;
  resendStatusFilter: "all" | "Invited" | "DeliveryFailed";
  setResendStatusFilter: (value: "all" | "Invited" | "DeliveryFailed") => void;
  resendTestFilter: string;
  setResendTestFilter: (value: string) => void;
  tests: Test[];
  resendError: string | null;
  resendSuccess: string | null;
  filteredResendInvitations: CandidateInvitation[];
  initialsFromInvitation: (item: CandidateInvitation) => string;
  setResendError: (value: string | null) => void;
  setResendModalItem: (item: CandidateInvitation | null) => void;
  resendModalItem: CandidateInvitation | null;
  resendSubmitting: boolean;
  onConfirmResend: () => Promise<void>;
}

export function ResendTab({
  resendSearch,
  setResendSearch,
  resendStatusFilter,
  setResendStatusFilter,
  resendTestFilter,
  setResendTestFilter,
  tests,
  resendError,
  resendSuccess,
  filteredResendInvitations,
  initialsFromInvitation,
  setResendError,
  setResendModalItem,
  resendModalItem,
  resendSubmitting,
  onConfirmResend,
}: ResendTabProps) {
  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,170px,220px]">
          <input
            id="resend-search"
            name="resendSearch"
            aria-label="Search invitations"
            value={resendSearch}
            onChange={(e) => setResendSearch(e.target.value)}
            placeholder="Search candidate, email, or test"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <select
            id="resend-status-filter"
            name="resendStatusFilter"
            aria-label="Filter invitations by status"
            value={resendStatusFilter}
            onChange={(e) => setResendStatusFilter(e.target.value as "all" | "Invited" | "DeliveryFailed")}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="all">All status</option>
            <option value="Invited">Invited</option>
            <option value="DeliveryFailed">Delivery Failed</option>
          </select>
          <select
            id="resend-test-filter"
            name="resendTestFilter"
            aria-label="Filter invitations by test"
            value={resendTestFilter}
            onChange={(e) => setResendTestFilter(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="all">All tests</option>
            {tests.map((test) => (
              <option key={test.id} value={test.id}>
                {test.title}
              </option>
            ))}
          </select>
        </div>
      </section>

      {resendError ? <p className="text-[12px] text-red-600">{resendError}</p> : null}
      {resendSuccess ? <p className="text-[12px] text-emerald-700">{resendSuccess}</p> : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Candidate</th>
                <th className="px-4 py-3 font-semibold">Test</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Sent</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredResendInvitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No invitations match your filters.
                  </td>
                </tr>
              ) : (
                filteredResendInvitations.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700">
                          {initialsFromInvitation(item)}
                        </span>
                        <div>
                          <p className="font-semibold text-zinc-900">{item.candidateName || "Unnamed Candidate"}</p>
                          <p className="text-[12px] text-zinc-500">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{item.testTitle}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          item.status === "Invited"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {new Date(item.lastSentAtUtc || item.createdAtUtc).toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setResendError(null);
                          setResendModalItem(item);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        <Send className="h-3.5 w-3.5" /> Resend
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {resendModalItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <h3 className="text-[18px] font-semibold text-zinc-900">Resend Invitation</h3>
            <p className="mt-1 text-[13px] text-zinc-500">Please confirm the candidate details before resending.</p>

            <div className="mt-4 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[13px] text-zinc-700">
              <p>
                Candidate: <span className="font-semibold">{resendModalItem.candidateName || "Unnamed Candidate"}</span>
              </p>
              <p>
                Email: <span className="font-semibold">{resendModalItem.email}</span>
              </p>
              <p>
                Test: <span className="font-semibold">{resendModalItem.testTitle}</span>
              </p>
              <p>
                Current status: <span className="font-semibold">{resendModalItem.status}</span>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setResendModalItem(null)}
                disabled={resendSubmitting}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void onConfirmResend()}
                disabled={resendSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {resendSubmitting ? "Resending..." : "Confirm Resend"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
