import { Suspense } from "react";
import type { Metadata } from "next";
import { ActivateInvitation } from "../activate-invitation/activate-invitation";
import { ADMINISTRATOR_JOURNEY } from "../../lib/activation";

export const metadata: Metadata = {
  title: "Accept administrator invitation - Fusion",
};

export default function Page() {
  return (
    <Suspense>
      <ActivateInvitation journey={ADMINISTRATOR_JOURNEY} />
    </Suspense>
  );
}
