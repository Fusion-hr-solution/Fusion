import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { ResendStatusFilter, ResendTabProps } from "@/services/models/resend_tab_model";
import type { CandidateInvitation } from "@/types";

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
  onDeleteCandidate,
  deleteSubmitting = false,
}: ResendTabProps) {
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CandidateInvitation | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem || !onDeleteCandidate) return;
    setDeleteError(null);
    try {
      await onDeleteCandidate(deleteConfirmItem.id);
      setDeleteConfirmItem(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete candidate");
    }
  };

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
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <DropdownSelect
            id="resend-status-filter"
            ariaLabel="Filter invitations by status"
            value={resendStatusFilter}
            placeholder="All status"
            options={[
              { value: "all", label: "All status" },
              { value: "Invited", label: "Invited" },
              { value: "DeliveryFailed", label: "Delivery Failed" },
            ]}
            onChange={(value) => setResendStatusFilter(value as ResendStatusFilter)}
          />
          <DropdownSelect
            id="resend-test-filter"
            ariaLabel="Filter invitations by test"
            value={resendTestFilter}
            placeholder="All tests"
            options={[{ value: "all", label: "All tests" }, ...tests.map((test) => ({ value: test.id, label: test.title }))]}
            onChange={setResendTestFilter}
          />
        </div>
      </section>

      {resendError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          {resendError}
        </div>
      ) : null}
      {resendSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700">
          {resendSuccess}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-zinc-200 bg-zinc-50/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-zinc-700">Candidate</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Test</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Status</th>
                <th className="px-4 py-3 font-semibold text-zinc-700">Last Sent</th>
                <th className="px-4 py-3 text-right font-semibold text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredResendInvitations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    <p className="text-[13px]">No invitations match your filters.</p>
                  </td>
                </tr>
              ) : (
                filteredResendInvitations.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 text-[11px] font-bold text-zinc-700">
                          {initialsFromInvitation(item)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-900">{item.candidateName || "Unnamed Candidate"}</p>
                          <p className="truncate text-[12px] text-zinc-500">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <span className="line-clamp-1">{item.testTitle}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                          item.status === "Invited"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-zinc-600">
                      {new Date(item.lastSentAtUtc || item.createdAtUtc).toLocaleDateString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResendError(null);
                            setResendModalItem(item);
                          }}
                          title="Resend invitation"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Resend</span>
                        </button>
                        {onDeleteCandidate && (
                          <button
                            onClick={() => setDeleteConfirmItem(item)}
                            title="Delete candidate invitation"
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition-all hover:border-red-300 hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {resendModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4">
          <div className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-zinc-900">Resend Invitation</h3>
                <p className="text-[12px] text-zinc-500">Confirm to resend the invitation</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[13px]">
              <div>
                <p className="text-zinc-500">Candidate</p>
                <p className="font-semibold text-zinc-900">{resendModalItem.candidateName || "Unnamed Candidate"}</p>
              </div>
              <div>
                <p className="text-zinc-500">Email</p>
                <p className="break-all font-semibold text-zinc-900">{resendModalItem.email}</p>
              </div>
              <div>
                <p className="text-zinc-500">Test</p>
                <p className="font-semibold text-zinc-900">{resendModalItem.testTitle}</p>
              </div>
              <div>
                <p className="text-zinc-500">Current Status</p>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold",
                    resendModalItem.status === "Invited"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {resendModalItem.status}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setResendModalItem(null)}
                disabled={resendSubmitting}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 transition-all hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void onConfirmResend()}
                disabled={resendSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {resendSubmitting ? "Resending..." : "Resend Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmItem && onDeleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4">
          <div className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-zinc-900">Delete Invitation</h3>
                <p className="text-[12px] text-zinc-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px]">
              <p className="text-red-900">
                Are you sure you want to delete the invitation for <strong>{deleteConfirmItem.candidateName || "this candidate"}</strong>?
              </p>
              <p className="mt-2 text-red-800">Email: <strong>{deleteConfirmItem.email}</strong></p>
            </div>

            {deleteError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                disabled={deleteSubmitting}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 transition-all hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteSubmitting ? "Deleting..." : "Delete Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
