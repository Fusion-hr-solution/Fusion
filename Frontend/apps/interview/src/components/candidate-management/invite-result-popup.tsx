import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InviteResultPopupProps } from "@/services/models/invite_result_popup_model";

export function InviteResultPopup({ result }: InviteResultPopupProps) {
  if (!result) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              result.status === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {result.status === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </span>
          <div>
            <p className="text-[15px] font-semibold text-zinc-900">Invitation status</p>
            <p className="mt-1 text-[13px] text-zinc-600">{result.message}</p>
            <p className="mt-2 text-[12px] text-zinc-400">Returning to Step 1...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
