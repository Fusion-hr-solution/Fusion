import { Suspense } from "react";
import type { Metadata } from "next";
import { ActivateInvitation } from "../activate-invitation/activate-invitation";
import { RECOVERY_JOURNEY } from "../../lib/activation";

export const metadata: Metadata = {
  title: "Recover administrator access - Fusion",
};

export default function Page() {
  return (
    <Suspense>
      <ActivateInvitation journey={RECOVERY_JOURNEY} />
    </Suspense>
  );
}
