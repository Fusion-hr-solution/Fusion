import type { ElementType } from "react";
import { Check, FileUp, Link2, Mail, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { InviteMethod, InviteTabProps } from "../../../services/models/invite_tab_model";

export function InviteTab({
  inviteStep,
  inviteMethod,
  recipients,
  csvPreviewRows,
  candidateName,
  setCandidateName,
  emailChips,
  removeEmailChip,
  emailInput,
  setEmailInput,
  handleEmailKeyDown,
  addEmailChip,
  clearAllEmailChips,
  importCsvEmails,
  selectedTestId,
  setSelectedTestId,
  tests,
  deadlineDate,
  setDeadlineDate,
  timeLimitMinutes,
  setTimeLimitMinutes,
  linkExpiryHours,
  setLinkExpiryHours,
  sendNowNotification,
  setSendNowNotification,
  customMessage,
  setCustomMessage,
  selectedTest,
  inviteError,
  inviteSuccess,
  goPrevStep,
  goNextStep,
  canProceedFromStep,
  submitting,
  handleSendInvitations,
  selectMethod,
}: InviteTabProps) {
  const stepChips: Array<{ id: 1 | 2 | 3; label: string }> = [
    { id: 1, label: "Method" },
    { id: 2, label: "Candidates" },
    { id: 3, label: "Configure" },
  ];

  const methodCards: Array<{ key: InviteMethod; label: string; helper: string; icon: ElementType }> = [
    {
      key: "email",
      label: "Email",
      helper: "Individual invites by entering emails",
      icon: Mail,
    },
    {
      key: "bulk",
      label: "Bulk CSV",
      helper: "Mass upload recipients from CSV",
      icon: FileUp,
    },
    {
      key: "link",
      label: "Link Invite",
      helper: "Generate and send a secure candidate link",
      icon: Link2,
    },
  ];

  const stepTitle =
    inviteStep === 1
      ? "Step 1: Choose Method"
      : inviteStep === 2
        ? "Step 2: Add Candidates"
        : "Step 3: Configure & Send";

  const stepHint =
    inviteStep === 1
      ? "Select how invitations will be delivered."
      : inviteStep === 2
        ? "Add recipients and verify candidate count before moving on."
        : "Finalize delivery settings and review before sending.";

  const stepSubtitle =
    inviteStep === 1
      ? "Choose one invitation channel to continue."
      : inviteStep === 2
        ? "Select recipients and confirm candidate count."
        : "Set invitation options and review before sending.";

  return (
    <div className="mt-5 space-y-5">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-5">
          <div>
            <p className="text-[18px] font-semibold text-zinc-900">{stepTitle}</p>
            <p className="mt-1 text-[12px] text-zinc-500">{stepHint}</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-[12px] text-zinc-400">{stepSubtitle}</p>
            {inviteStep === 2 ? (
              <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-700">
              {recipients.length} candidate(s) ready
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-6">
            <div className="mx-auto flex w-full max-w-3xl items-center">
              {stepChips.map((step, i) => {
                const isActive = inviteStep === step.id;
                const isDone = inviteStep > step.id;

                return (
                  <div key={step.id} className="flex flex-1 items-center">
                    {i > 0 ? (
                      <div className={cn("h-[2px] flex-1 rounded-full", inviteStep > i ? "bg-zinc-900" : "bg-zinc-100")} />
                    ) : null}

                    <div className="flex flex-col items-center gap-1.5 px-2">
                      <div
                        className={cn(
                          "relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300",
                          isDone
                            ? "bg-zinc-900 text-white"
                            : isActive
                              ? "scale-110 bg-zinc-900 text-white shadow-[0_0_0_4px_rgba(0,0,0,0.08)]"
                              : "border-2 border-zinc-200 bg-white text-zinc-300"
                        )}
                      >
                        {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step.id}
                        {isActive ? <span className="absolute inset-0 animate-ping rounded-full bg-zinc-900 opacity-10" /> : null}
                      </div>
                      <div className="text-center" style={{ minWidth: 84 }}>
                        <p className={cn("text-[12px] font-semibold leading-tight", isActive ? "text-zinc-900" : isDone ? "text-zinc-500" : "text-zinc-400")}>
                          {step.label}
                        </p>
                        <p className={cn("mt-0.5 text-[10px]", isDone ? "text-zinc-400" : isActive ? "text-zinc-400" : "text-zinc-300")}>
                          {isDone ? "Complete" : isActive ? "In progress" : "Pending"}
                        </p>
                      </div>
                    </div>

                    {i < stepChips.length - 1 ? (
                      <div
                        className={cn(
                          "h-[2px] flex-1 rounded-full",
                          inviteStep > step.id ? "bg-zinc-900" : "bg-zinc-100"
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {inviteStep === 1 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {methodCards.map((method) => {
              const active = inviteMethod === method.key;
              return (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => selectMethod(method.key)}
                  className={cn(
                    "rounded-xl border-2 bg-white p-4 text-left shadow-sm transition-colors",
                    active ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-300"
                  )}
                >
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                    <method.icon className="h-4 w-4 text-zinc-700" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-zinc-900">{method.label}</p>
                    {active ? <Check className="h-4 w-4 text-zinc-900" /> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-zinc-500">{method.helper}</p>
                </button>
              );
            })}
            </div>
          ) : null}

          {inviteStep === 2 ? (
            <div className="space-y-4">
              {inviteMethod === "bulk" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-zinc-600">Bulk Candidate Import</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                      {recipients.length} candidates added
                    </span>
                  </div>

                  <label htmlFor="bulk-csv-file" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50">
                    <FileUp className="h-3.5 w-3.5" /> Import CSV
                    <input
                      id="bulk-csv-file"
                      name="bulkCsvFile"
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void importCsvEmails(file);
                        }
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>

                  {csvPreviewRows.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                        <p className="text-[12px] font-semibold text-zinc-700">
                          Imported candidates ({csvPreviewRows.length})
                        </p>
                        <button
                          type="button"
                          onClick={clearAllEmailChips}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700"
                        >
                          <X className="h-3 w-3" /> Clear all
                        </button>
                      </div>
                      <div className="max-h-64 overflow-auto">
                        <table className="min-w-full text-left text-[12px]">
                          <thead className="bg-white text-zinc-500">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Name</th>
                              <th className="px-3 py-2 font-semibold">Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreviewRows.map((item) => (
                              <tr key={item.email} className="border-t border-zinc-100">
                                <td className="px-3 py-2 text-zinc-700">{item.name || "-"}</td>
                                <td className="px-3 py-2 font-medium text-zinc-900">{item.email}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="invite-candidate-name" className="mb-1 block text-[12px] font-semibold text-zinc-600">Candidate Name (optional)</label>
                    <input
                      id="invite-candidate-name"
                      name="candidateName"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="Ex: Alex Smith"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor="invite-candidate-emails" className="block text-[12px] font-semibold text-zinc-600">Candidate Emails</label>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                        {recipients.length} candidates added
                      </span>
                    </div>
                    <div className="min-h-[44px] rounded-xl border border-zinc-200 bg-white px-2 py-2 focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-900/10">
                      <div className="flex flex-wrap items-center gap-2">
                        {emailChips.map((email) => (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            {email}
                            <button
                              type="button"
                              onClick={() => removeEmailChip(email)}
                              className="text-white/80 hover:text-white"
                            >
                              x
                            </button>
                          </span>
                        ))}
                        <input
                          id="invite-candidate-emails"
                          name="candidateEmails"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          onKeyDown={handleEmailKeyDown}
                          onBlur={() => {
                            if (emailInput.trim()) {
                              addEmailChip(emailInput);
                              setEmailInput("");
                            }
                          }}
                          placeholder="Type email and press Enter"
                          className="min-w-[220px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-zinc-900 outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-zinc-500">Use Enter or comma to add each email chip.</p>
                      {emailChips.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearAllEmailChips}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700"
                        >
                          <X className="h-3 w-3" /> Clear all
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              )}

            {inviteMethod === "link" ? (
              <div>
                <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
                  Share Link mode still tracks entered recipients for audit and delivery reporting.
                </p>
              </div>
            ) : null}
            </div>
          ) : null}

          {inviteStep === 3 ? (
            <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DropdownSelect
                id="invite-test"
                label="Test"
                placeholder="Select a test"
                value={selectedTestId}
                options={tests.map((test) => ({ value: test.id, label: test.title }))}
                onChange={setSelectedTestId}
              />

              <div>
                <label htmlFor="invite-deadline" className="mb-1 block text-[12px] font-semibold text-zinc-600">Deadline (optional)</label>
                <input
                  id="invite-deadline"
                  name="deadlineDate"
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="invite-time-limit" className="mb-1 block text-[12px] font-semibold text-zinc-600">Time Limit (minutes)</label>
                <input
                  id="invite-time-limit"
                  name="timeLimitMinutes"
                  type="number"
                  min={1}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>

              <div>
                <label htmlFor="invite-link-expiry" className="mb-1 block text-[12px] font-semibold text-zinc-600">Link Expiry (hours)</label>
                <input
                  id="invite-link-expiry"
                  name="linkExpiryHours"
                  type="number"
                  min={1}
                  max={720}
                  value={linkExpiryHours}
                  onChange={(e) => setLinkExpiryHours(Math.min(720, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
              </div>

              <div className="space-y-2 pt-6">
                <label htmlFor="invite-send-now" className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700">
                  <input
                    id="invite-send-now"
                    name="sendNowNotification"
                    type="checkbox"
                    checked={sendNowNotification}
                    onChange={(e) => setSendNowNotification(e.target.checked)}
                  />
                  Send immediate notification email
                </label>

              </div>
            </div>

            <div>
              <label htmlFor="invite-custom-message" className="mb-1 block text-[12px] font-semibold text-zinc-600">Custom Message</label>
              <textarea
                id="invite-custom-message"
                name="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add a personalized note for candidates..."
                className="min-h-[100px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">Pre-send Summary</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-[13px] text-zinc-700 md:grid-cols-2">
                <p>Method: <span className="font-semibold capitalize">{inviteMethod}</span></p>
                <p>Recipients: <span className="font-semibold">{recipients.length}</span></p>
                <p>Test: <span className="font-semibold">{selectedTest?.title || "Not selected"}</span></p>
                <p>Deadline: <span className="font-semibold">{deadlineDate || "None"}</span></p>
                <p>Link expiry: <span className="font-semibold">{linkExpiryHours} hour(s)</span></p>
                <p>Time limit: <span className="font-semibold">{timeLimitMinutes} min</span></p>

                <p className="md:col-span-2">
                  Candidate Name: <span className="font-semibold">{candidateName.trim() || "Not provided"}</span>
                </p>
                <p className="md:col-span-2">
                  Notifications: <span className="font-semibold">{sendNowNotification ? "Send immediately" : "Draft only"}</span>
                </p>
                {customMessage.trim() ? (
                  <p className="md:col-span-2 text-zinc-600">
                    Message preview: <span className="font-medium">{customMessage.trim().slice(0, 140)}{customMessage.trim().length > 140 ? "..." : ""}</span>
                  </p>
                ) : null}
              </div>
            </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-5">
            <div>
              {inviteError ? <p className="text-[12px] text-red-600">{inviteError}</p> : null}
              {inviteSuccess ? <p className="text-[12px] text-emerald-700">{inviteSuccess}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goPrevStep}
                disabled={inviteStep === 1 || submitting}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              {inviteStep < 3 ? (
                <button
                  onClick={goNextStep}
                  disabled={submitting || (inviteStep === 2 && !canProceedFromStep(2))}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={() => void handleSendInvitations()}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? "Sending..." : "Send Invitations"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
