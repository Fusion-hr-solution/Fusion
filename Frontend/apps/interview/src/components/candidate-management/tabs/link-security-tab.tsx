import { Clock3, Link2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownSelect } from "@/components/candidate-management/dropdown-select";
import type { GracePeriodUnit, LinkValidityUnit } from "@/types";
import type { LinkSecurityTabProps } from "@/services/models/link_security_tab_model";

export function LinkSecurityTab({
  selectedTestId,
  setSelectedTestId,
  tests,
  linkSecurityLoading,
  linkSecurityError,
  linkSecuritySuccess,
  singleUseLinkEnabled,
  setSingleUseLinkEnabled,
  emailVerificationEnabled,
  setEmailVerificationEnabled,
  ipLockEnabled,
  setIpLockEnabled,
  browserFingerprintEnabled,
  setBrowserFingerprintEnabled,
  linkValidForValue,
  setLinkValidForValue,
  linkValidForUnit,
  setLinkValidForUnit,
  gracePeriodValue,
  setGracePeriodValue,
  gracePeriodUnit,
  setGracePeriodUnit,
  linkPreview,
  formatUtcForCard,
  onCopyLinkSecurityPreview,
  onRegenerateLinkSecurity,
  linkSecurityRegenerating,
  onSaveLinkSecuritySettings,
  linkSecuritySaving,
}: LinkSecurityTabProps) {
  const hasPreviewInvitation = Boolean(linkPreview?.hasInvitation && linkPreview.inviteLink);
  const previewInviteLink =
    linkPreview?.inviteLink ??
    "No active invitation link yet. Send an invitation to generate one.";
  const usesValue = hasPreviewInvitation
    ? `${linkPreview?.opensCount ?? 0} / ${linkPreview?.allowedUses ?? "Unlimited"}`
    : `0 / ${singleUseLinkEnabled ? "1" : "Unlimited"}`;
  const expiresValue = hasPreviewInvitation
    ? formatUtcForCard(linkPreview?.tokenExpiresAtUtc)
    : "Not generated";
  const securityScore =
    Number(singleUseLinkEnabled) +
    Number(emailVerificationEnabled) +
    Number(ipLockEnabled) +
    Number(browserFingerprintEnabled);
  const securityLevel =
    linkPreview?.securityLevel ?? (securityScore >= 3 ? "High" : securityScore === 2 ? "Medium" : "Low");

  const securityRows: Array<{
    key: string;
    label: string;
    helper?: string;
    enabled: boolean;
    onToggle: () => void;
  }> = [
    {
      key: "single-use-link",
      label: "Single-use link (expires after first access)",
      enabled: singleUseLinkEnabled,
      onToggle: () => setSingleUseLinkEnabled((prev) => !prev),
    },
    {
      key: "email-verification",
      label: "Require email verification before test start",
      enabled: emailVerificationEnabled,
      onToggle: () => setEmailVerificationEnabled((prev) => !prev),
    },
    {
      key: "ip-lock",
      label: "IP lock - bind link to first IP address",
      helper: "Useful for strict environments but can be sensitive to network changes.",
      enabled: ipLockEnabled,
      onToggle: () => setIpLockEnabled((prev) => !prev),
    },
    {
      key: "browser-fingerprint",
      label: "Browser fingerprint check",
      enabled: browserFingerprintEnabled,
      onToggle: () => setBrowserFingerprintEnabled((prev) => !prev),
    },
  ];

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px,1fr] md:items-end">
          <DropdownSelect
            id="link-security-test"
            label="Apply Settings To"
            placeholder="Select test"
            value={selectedTestId}
            options={tests.map((test) => ({ value: test.id, label: test.title }))}
            onChange={setSelectedTestId}
          />
          <p className="text-[12px] leading-relaxed text-zinc-500">
            Saved settings are scoped per test and update pending invitation expiry windows.
          </p>
        </div>
      </section>

      {linkSecurityLoading ? <p className="text-[12px] text-zinc-500">Loading link security settings...</p> : null}
      {linkSecurityError ? <p className="text-[12px] text-red-600">{linkSecurityError}</p> : null}
      {linkSecuritySuccess ? <p className="text-[12px] text-emerald-700">{linkSecuritySuccess}</p> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
              <ShieldCheck className="h-4 w-4 text-zinc-600" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-zinc-900">Security Settings</p>
              <p className="text-[12px] text-zinc-500">Define how links are validated before test access.</p>
            </div>
          </div>

          <div className="px-6">
            {securityRows.map((item, index) => (
              <div
                key={item.key}
                className={cn(
                  "flex items-start justify-between gap-4 py-3.5",
                  index < securityRows.length - 1 ? "border-b border-zinc-100" : ""
                )}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-[13px] font-semibold text-zinc-900">{item.label}</p>
                  {item.helper ? <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-400">{item.helper}</p> : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  onClick={item.onToggle}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:ring-offset-2",
                    item.enabled ? "bg-zinc-900" : "bg-zinc-200"
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                      item.enabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
              <Clock3 className="h-4 w-4 text-zinc-600" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-zinc-900">Expiry Rules</p>
              <p className="text-[12px] text-zinc-500">Control how long links remain active after delivery.</p>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 px-6">
            <div className="py-4">
              <label htmlFor="link-valid-for-value" className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-zinc-400">Link valid for</label>
              <div className="flex items-center gap-2">
                <input
                  id="link-valid-for-value"
                  name="linkValidForValue"
                  type="number"
                  min={1}
                  value={linkValidForValue}
                  onChange={(e) => setLinkValidForValue(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-[13px] font-medium text-zinc-900 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <DropdownSelect
                  id="link-valid-for-unit"
                  ariaLabel="Link validity unit"
                  value={linkValidForUnit}
                  placeholder="Unit"
                  options={[
                    { value: "days", label: "days" },
                    { value: "hours", label: "hours" },
                    { value: "minutes", label: "minutes" },
                  ]}
                  onChange={(value) => setLinkValidForUnit(value as LinkValidityUnit)}
                  className="w-32"
                  buttonClassName="py-2"
                />
              </div>
              <p className="mt-1.5 text-[12px] text-zinc-400">Candidates see a countdown after opening.</p>
            </div>

            <div className="py-4">
              <label htmlFor="grace-period-value" className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-zinc-400">Grace period after expiry</label>
              <div className="flex items-center gap-2">
                <input
                  id="grace-period-value"
                  name="gracePeriodValue"
                  type="number"
                  min={1}
                  value={gracePeriodValue}
                  onChange={(e) => setGracePeriodValue(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-right text-[13px] font-medium text-zinc-900 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                />
                <DropdownSelect
                  id="grace-period-unit"
                  ariaLabel="Grace period unit"
                  value={gracePeriodUnit}
                  placeholder="Unit"
                  options={[
                    { value: "minutes", label: "minutes" },
                    { value: "hours", label: "hours" },
                  ]}
                  onChange={(value) => setGracePeriodUnit(value as GracePeriodUnit)}
                  className="w-32"
                  buttonClassName="py-2"
                />
              </div>
              <p className="mt-1.5 text-[12px] text-zinc-400">Extra time before the session is terminated.</p>
            </div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
            <Link2 className="h-4 w-4 text-zinc-600" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-zinc-900">Link Preview</p>
            <p className="text-[12px] text-zinc-500">Inspect generated URL details before sharing with candidates.</p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 md:flex-row md:items-center md:justify-between">
            <code
              className={cn(
                "overflow-x-auto text-[12px] font-semibold",
                hasPreviewInvitation ? "text-blue-700" : "text-zinc-500"
              )}
            >
              {previewInviteLink}
            </code>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void onCopyLinkSecurityPreview()}
                disabled={!hasPreviewInvitation}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-100"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => void onRegenerateLinkSecurity()}
                disabled={linkSecurityRegenerating || !selectedTestId}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors duration-150 hover:bg-zinc-100"
              >
                {linkSecurityRegenerating ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Uses</p>
              <p className="mt-0.5 text-[15px] font-bold text-zinc-900">{usesValue}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Expires</p>
              <p className="mt-0.5 text-[15px] font-bold text-zinc-900">{expiresValue}</p>
            </div>
            <div
              className={cn(
                "rounded-xl px-3 py-2.5",
                securityLevel === "High"
                  ? "border border-blue-200 bg-blue-50"
                  : securityLevel === "Medium"
                    ? "border border-amber-200 bg-amber-50"
                    : "border border-zinc-200 bg-zinc-50"
              )}
            >
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  securityLevel === "High"
                    ? "text-blue-700"
                    : securityLevel === "Medium"
                      ? "text-amber-700"
                      : "text-zinc-500"
                )}
              >
                Security
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[15px] font-bold",
                  securityLevel === "High"
                    ? "text-blue-800"
                    : securityLevel === "Medium"
                      ? "text-amber-800"
                      : "text-zinc-800"
                )}
              >
                {securityLevel}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end border-t border-zinc-100 pt-5">
        <button
          type="button"
          onClick={() => void onSaveLinkSecuritySettings()}
          disabled={linkSecuritySaving || linkSecurityLoading || !selectedTestId}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-800 active:scale-[0.98]"
        >
          {linkSecuritySaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
