import { Suspense } from "react";
import { PublicInviteView } from "@/modules/corehr/components/public-invite-view";

export default function PublicInviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ch-surface font-chBody text-ch-on-surface">
          Loading invitation…
        </div>
      }
    >
      <PublicInviteView />
    </Suspense>
  );
}
