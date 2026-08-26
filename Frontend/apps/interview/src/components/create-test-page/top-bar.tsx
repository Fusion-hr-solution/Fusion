"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowLeft, BookmarkPlus,
  Cloud, Loader2, CheckCircle2, MonitorPlay,
} from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useWizardStore } from "@/store/wizard-store";
import { useTestPersistence } from "@/hooks/use-test-persistence";
import { cn } from "@/lib/utils";

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="bottom"
            sideOffset={8}
            className="z-50 max-w-[200px] rounded-lg bg-zinc-900 px-3 py-1.5 text-center text-[12px] leading-snug text-white shadow-lg"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-zinc-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function TopBar() {
  const router = useRouter();
  const { step, isDirty, lastSaved, markSaved, basicInfo, reset } = useWizardStore();
  const { saveDraft } = useTestPersistence();
  const [saving,    setSaving]    = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const id = setTimeout(() => {
      setSaving(true);
      setTimeout(() => {
        markSaved();
        setSaving(false);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }, 700);
    }, 1500);
    return () => clearTimeout(id);
  }, [isDirty, markSaved]);

  function handleBack() {
    isDirty ? setAlertOpen(true) : router.push("/");
  }

  function confirmLeave() {
    reset();
    router.push("/");
  }
  async function handleSaveDraft() {
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await saveDraft();
      setActionMessage("Draft saved.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* sticky — participates in flow, no spacer needed */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-100 bg-white/95 px-6 backdrop-blur-sm">

        {/* Left */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            className="group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-500 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
            Back
          </button>
          <div className="mx-2 h-4 w-px bg-zinc-200" />
          <nav className="flex items-center gap-1.5 text-[13px]">
            <span
              className="cursor-pointer text-zinc-400 transition-colors duration-150 hover:text-zinc-600"
              onClick={() => router.push("/")}
            >
              Tests
            </span>
            <span className="text-zinc-300">/</span>
            <span className="font-semibold text-zinc-900">
              {basicInfo.title || "New Test"}
            </span>
          </nav>
        </div>

        {/* Center — save indicator */}
        <div className="flex items-center gap-1.5 rounded-full border border-zinc-100 bg-zinc-50 px-3 py-1">
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
              <span className="text-[12px] text-zinc-400">Saving…</span>
            </>
          ) : justSaved ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[12px] font-medium text-emerald-600">Saved</span>
            </>
          ) : lastSaved ? (
            <>
              <Cloud className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-[12px] text-zinc-400">All changes saved</span>
            </>
          ) : (
            <>
              <Cloud className="h-3.5 w-3.5 text-zinc-300" />
              <span className="text-[12px] text-zinc-300">Draft</span>
            </>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {step === 4 ? (
            <button
              onClick={() => router.push("/tests/create/preview")}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-zinc-600 shadow-sm transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-none"
            >
              <MonitorPlay className="h-4 w-4" />
              Candidate view
            </button>
          ) : (
            <Tooltip content="Candidate view is available after reaching Step 4 (Review)">
              <span>
                <button
                  disabled
                  className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3.5 py-1.5 text-[13px] font-medium text-zinc-400"
                >
                  <MonitorPlay className="h-4 w-4" />
                  Candidate view
                </button>
              </span>
            </Tooltip>
          )}

          <button
            onClick={() => void handleSaveDraft()}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-zinc-600 shadow-sm transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-none"
          >
            <BookmarkPlus className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Draft"}
          </button>

        </div>
      </header>
        {actionMessage && (
        <div className="border-b border-zinc-100 bg-white px-6 py-2 text-[12px] text-zinc-600">
          {actionMessage}
        </div>
      )}

      {/* Unsaved changes alert */}
      <AlertDialog.Root open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              <ArrowLeft className="h-5 w-5 text-zinc-600" />
            </div>
            <AlertDialog.Title className="mt-3 text-[17px] font-semibold text-zinc-900">
              Leave without saving?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
              You have unsaved changes. Your draft is stored locally but any unpublished edits will be lost if you leave now.
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors duration-150">
                  Keep Editing
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={confirmLeave}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 transition-colors duration-150"
                >
                  Leave Anyway
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}