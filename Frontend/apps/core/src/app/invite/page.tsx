import { Suspense } from "react";
import type { Metadata } from "next";
import { InviteAcceptanceForm } from "./invite-acceptance-form";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Accept Invitation — Fusion",
  description: "Accept your administrator invitation to join the Fusion platform.",
};

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      }
    >
      <InviteAcceptanceForm />
    </Suspense>
  );
}
