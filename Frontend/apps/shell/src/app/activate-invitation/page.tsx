import { Suspense } from "react";
import type { Metadata } from "next";
import { ActivateInvitation } from "./activate-invitation";

export const metadata: Metadata = {
  title: "Create administrator account - Fusion",
};

export default function Page() {
  return (
    <Suspense>
      <ActivateInvitation />
    </Suspense>
  );
}
